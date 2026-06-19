/**
 * motor-ai-sidecar — pasarela de IA local-first para artefactos/plugins del Motor.
 *
 * INDEPENDIENTE del Motor: proceso aparte (no toca su código) → sobrevive a updates.
 * Loopback-only (127.0.0.1) + CORS para que un artefacto en localhost:8081 lo llame.
 *
 * Endpoints:
 *   GET  /models  → IAs disponibles (locales + nubes con key) — alimenta el SELECTOR
 *   POST /ai      → { model, prompt | messages, max_tokens? } → { text, model, provider }
 *
 * Trata Ollama, LM Studio y las nubes como fuentes OpenAI-compatibles
 * (`/v1/models` + `/v1/chat/completions`). Anthropic se maneja aparte (su API propia).
 * Las keys de nube viven en el .env del sidecar (NO toca el Motor ni Hermes).
 *
 * Arranque:  bun run ai-sidecar/server.ts
 */
const PORT = Number(process.env.MOTOR_AI_PORT ?? 8899);

type Source = { name: string; base: string; key: string; local: boolean };

// Fuentes OpenAI-compatibles. Locales siempre se sondean; nubes solo si hay key.
const SOURCES: Source[] = [
  { name: "ollama", base: process.env.OLLAMA_URL ?? "http://localhost:11434/v1", key: "", local: true },
  { name: "lmstudio", base: process.env.LMSTUDIO_URL ?? "http://localhost:1234/v1", key: "", local: true },
  { name: "openrouter", base: "https://openrouter.ai/api/v1", key: process.env.OPENROUTER_API_KEY ?? "", local: false },
  { name: "openai", base: "https://api.openai.com/v1", key: process.env.OPENAI_API_KEY ?? "", local: false },
];
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*", // loopback-only de todos modos
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...CORS } });

type Msg = { role: string; content: string };
type ModelInfo = { id: string; provider: string; local: boolean; label: string };

// Mapa model-id → fuente, para enrutar en /ai. Se llena al listar modelos.
let MODEL_MAP: Record<string, Source> = {};

async function modelsFrom(src: Source): Promise<ModelInfo[]> {
  if (!src.local && !src.key) return [];
  try {
    const headers: Record<string, string> = {};
    if (src.key) headers.authorization = `Bearer ${src.key}`;
    const r = await fetch(`${src.base}/models`, { headers, signal: AbortSignal.timeout(2500) });
    if (!r.ok) return [];
    const d = (await r.json()) as { data?: Array<{ id: string }> };
    return (d.data ?? []).map((m) => {
      MODEL_MAP[m.id] = src;
      return {
        id: m.id,
        provider: src.name,
        local: src.local,
        label: `${m.id} · ${src.local ? "local" : "nube"} (${src.name})`,
      };
    });
  } catch {
    return []; // fuente no disponible (motor local apagado o nube sin red)
  }
}

async function listModels(): Promise<ModelInfo[]> {
  MODEL_MAP = {};
  const lists = await Promise.all(SOURCES.map(modelsFrom));
  const out = lists.flat();
  if (ANTHROPIC_KEY) {
    out.push({ id: "claude-sonnet-4-6", provider: "anthropic", local: false, label: "claude-sonnet-4-6 · nube (anthropic)" });
  }
  return out;
}

async function complete(input: { model: string; prompt?: string; messages?: Msg[]; max_tokens?: number; provider?: string }) {
  const model = input.model;
  const messages: Msg[] = input.messages ?? [{ role: "user", content: String(input.prompt ?? "") }];
  const maxTokens = Number(input.max_tokens ?? 2048); // holgura para modelos de razonamiento

  // Anthropic: API propia (no OpenAI-compat).
  if (input.provider === "anthropic" || /^claude/i.test(model)) {
    if (!ANTHROPIC_KEY) throw new Error("Falta ANTHROPIC_API_KEY en ai-sidecar/.env");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    });
    const d = (await r.json()) as { content?: Array<{ text?: string }>; error?: { message?: string } };
    if (!r.ok) throw new Error(d.error?.message || `Anthropic HTTP ${r.status}`);
    return { text: d.content?.[0]?.text ?? "", model, provider: "anthropic" };
  }

  // Resto: fuente OpenAI-compatible. Resolver por provider explícito o por el mapa.
  let src: Source | undefined =
    (input.provider && SOURCES.find((s) => s.name === input.provider)) || MODEL_MAP[model];
  if (!src) {
    await listModels(); // refresca el mapa por si el modelo es nuevo
    src = MODEL_MAP[model];
  }
  if (!src) throw new Error(`Modelo "${model}" no encontrado en ninguna fuente. Mira GET /models.`);
  if (!src.local && !src.key) throw new Error(`Falta ${src.name.toUpperCase()}_API_KEY en ai-sidecar/.env`);

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (src.key) headers.authorization = `Bearer ${src.key}`;
  const r = await fetch(`${src.base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  const d = (await r.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(d.error?.message || `${src.name} HTTP ${r.status}`);
  const msg = d.choices?.[0]?.message ?? {};
  // Modelos de razonamiento dejan content vacío y todo en reasoning_content.
  return { text: msg.content || msg.reasoning_content || "", model, provider: src.name };
}

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1", // loopback-only
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname === "/" && req.method === "GET")
      return json({ ok: true, service: "motor-ai-sidecar", port: PORT, endpoints: ["/models", "/ai"] });
    if (url.pathname === "/models" && req.method === "GET") return json({ models: await listModels() });
    if (url.pathname === "/ai" && req.method === "POST") {
      let body: { model?: string; prompt?: string; messages?: Msg[]; max_tokens?: number; provider?: string };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return json({ error: "JSON inválido" }, 400);
      }
      if (!body.model) return json({ error: "Falta 'model' (mira GET /models)" }, 400);
      try {
        return json(await complete(body as { model: string }));
      } catch (e) {
        return json({ error: String((e as Error).message || e) }, 502);
      }
    }
    return json({ error: "not found" }, 404);
  },
});

console.log(`motor-ai-sidecar en http://localhost:${PORT}  (GET /models · POST /ai)`);

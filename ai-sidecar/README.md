# motor-ai-sidecar

Pasarela de IA **local-first** para dar vida a artefactos/plugins del Motor, sin
atarlos a un proveedor ni meter API keys en el HTML.

- **Independiente del Motor** (proceso aparte) → sobrevive a actualizaciones del Motor.
- **Local-first:** usa **Ollama** y/o **LM Studio** (Gemma, Llama, Qwen…) sin key, sin nube.
- **Nube opcional:** OpenRouter / OpenAI / Anthropic (key en `.env` del sidecar).
- **Loopback-only** (127.0.0.1) + CORS.

## Arrancar
```bash
cd "sdk_motor agentico"
bun run ai-sidecar/server.ts      # http://localhost:8899
```
Para nube: `cp ai-sidecar/.env.example ai-sidecar/.env` y rellena las keys que uses.

### Motores locales
- **LM Studio:** Developer → "Enable Local LLM Service" (o `lms server start`). Sirve en `:1234`.
- **Ollama:** `ollama serve` + `ollama pull gemma3` (necesita el modelo descargado, no solo el manifest).

## Endpoints
- `GET /models` → lista de IAs disponibles (alimenta un **selector**).
- `POST /ai` → `{ model, prompt | messages, max_tokens? }` → `{ text, model, provider }`.

## Snippets (copy-paste)

### 1. Llamar a una IA
```js
const res = await fetch("http://localhost:8899/ai", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model: "google/gemma-4-12b-qat", prompt: "Hola", max_tokens: 2000 }),
});
const { text } = await res.json();
```

### 2. Selector de IAs disponibles
```js
const { models } = await (await fetch("http://localhost:8899/models")).json();
// models = [{ id, provider, local, label }]  → píntalo en un <select>
sel.innerHTML = models.map(m => `<option value="${m.id}">${m.label}</option>`).join("");
```

### 3. Revivir un artefacto exportado de Claude
Busca su llamada a la IA y cámbiala:
```diff
- const res = await fetch('https://api.anthropic.com/v1/messages', { ... })
- const raw = data.content?.find(b => b.type === 'text')?.text || '';
+ const res = await fetch('http://localhost:8899/ai', {
+   method: 'POST', headers: { 'content-type': 'application/json' },
+   body: JSON.stringify({ model: 'google/gemma-4-12b-qat', prompt, max_tokens: 2000 })
+ })
+ const raw = (await res.json()).text || '';
```

## Notas
- **Modelos de razonamiento** (p.ej. gemma-4-qat) ponen la salida en `reasoning_content`
  y necesitan `max_tokens` holgado; el sidecar ya cae a `reasoning_content` si `content`
  viene vacío. Para JSON estricto conviene un modelo no-razonador o subir `max_tokens`.
- Las keys de nube **nunca** salen al cliente; viven solo en `ai-sidecar/.env`.

/**
 * Puente de Claude — el "mayordomo".
 *
 * Al activarse, escucha los postMessage de los plugins-artefacto (los que el
 * shim de import_artifact inyecta) y resuelve sus peticiones llamando a Claude /
 * a la búsqueda que el Motor presta vía ctx.host. Así el artefacto cree que sigue
 * en claude.ai y el usuario no gestiona ninguna API key.
 *
 * Protocolo (postMessage):
 *   iframe → parent:  { __motorBridge: true, reqId, method: "claude.complete"|"web.search", params }
 *   parent → iframe:  { __motorBridge: true, reqId, result }  ó  { ..., error }
 */
import type { PluginContext, Deactivate } from "motor-agentico-plugin-sdk";

interface BridgeRequest {
  __motorBridge?: boolean;
  reqId?: string;
  method?: string;
  params?: Record<string, unknown>;
}

const KNOWN_METHODS = new Set(["claude.complete", "web.search"]);

export function activate(ctx: PluginContext): Deactivate {
  async function onMessage(event: MessageEvent) {
    const data = event.data as BridgeRequest;
    // Validación estricta: solo mensajes bien formados de nuestro protocolo.
    if (
      !data ||
      data.__motorBridge !== true ||
      typeof data.reqId !== "string" ||
      typeof data.method !== "string"
    ) {
      return;
    }

    const source = event.source as Window | null;
    const reply = (extra: Record<string, unknown>) => {
      // El iframe pudo desmontarse: responder nunca debe tumbar el puente.
      try {
        source?.postMessage(
          { __motorBridge: true, reqId: data.reqId, ...extra },
          "*",
        );
      } catch {
        /* destinatario ya no disponible */
      }
    };

    if (!KNOWN_METHODS.has(data.method)) {
      reply({ error: `método no soportado: ${data.method}` });
      return;
    }

    try {
      if (data.method === "claude.complete") {
        if (!ctx.host.claude) throw new Error("El Motor no expone Claude");
        const prompt = String(data.params?.prompt ?? "");
        const result = await ctx.host.claude.complete(prompt, data.params);
        reply({ result });
      } else if (data.method === "web.search") {
        if (!ctx.host.search) throw new Error("El Motor no expone búsqueda web");
        const result = await ctx.host.search(String(data.params?.query ?? ""));
        reply({ result });
      }
    } catch (err) {
      reply({ error: (err as Error).message });
    }
  }

  window.addEventListener("message", onMessage);
  // Limpieza al desactivar el plugin:
  return () => window.removeEventListener("message", onMessage);
}

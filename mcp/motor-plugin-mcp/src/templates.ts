/**
 * templates.ts — generadores de archivos para un plugin nuevo.
 *
 * El manifiesto se emite como plugin.json (fuente de verdad para tooling) y
 * plugin.manifest.ts lo envuelve con createPlugin(). Así el MCP puede
 * validar/listar sin ejecutar TypeScript.
 */
import type { PluginManifest } from "@motor-agentico/plugin-sdk";

export function manifestJson(m: PluginManifest): string {
  return JSON.stringify(m, null, 2) + "\n";
}

export function manifestTs(m: PluginManifest): string {
  const isTheme = m.type === "theme";
  const isTool = m.type === "tool";
  return `import { createPlugin } from "@motor-agentico/plugin-sdk";
import manifest from "./plugin.json";
${isTool ? "" : `import { Panel } from "./src/index";\n`}
export default createPlugin(manifest as Parameters<typeof createPlugin>[0], {
${isTool ? "" : "  Panel,\n"}${isTheme ? "  applyTheme: (config) => {\n    // TODO: aplica tu skin (CSS variables) según config\n  },\n" : ""}});
`;
}

export function panelTsx(m: PluginManifest): string {
  if (m.type === "theme") {
    return `/**
 * ${m.name} — panel de personalización (type: theme).
 * Edita aquí la UI con la que el usuario ajusta el skin del Motor.
 */
export function Panel() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">${m.name}</h1>
      <p className="text-muted-foreground">${m.description}</p>
      {/* TODO: controles del skin (color, fuente, densidad...) */}
    </div>
  );
}
`;
  }
  const usesData = m.data?.kind === "neurona-endpoint";
  return `/**
 * ${m.name} — panel principal del plugin (type: ${m.type}).
 */
${usesData ? `import { usePluginData } from "@motor-agentico/plugin-sdk/react";\n` : ""}
export function Panel() {
${usesData ? `  const { data, isLoading, error } = usePluginData("${m.id}");\n\n  if (isLoading) return <div className="p-6">Cargando…</div>;\n  if (error) return <div className="p-6 text-destructive">{error.message}</div>;\n` : ""}
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">${m.name}</h1>
      <p className="text-muted-foreground">${m.description}</p>
${usesData ? `      <pre className="mt-4 text-xs">{JSON.stringify(data, null, 2)}</pre>\n` : ""}    </div>
  );
}
`;
}

export function pkgJson(m: PluginManifest): string {
  return (
    JSON.stringify(
      {
        name: `@motor-plugin/${m.id}`,
        version: m.version,
        description: m.description,
        type: "module",
        private: true,
        dependencies: {
          "@motor-agentico/plugin-sdk": "workspace:*",
        },
      },
      null,
      2,
    ) + "\n"
  );
}

export function readme(m: PluginManifest): string {
  return `# ${m.name}

> ${m.description} — plugin del Motor Agéntico (\`type: ${m.type}\`).

Generado con el MCP \`forge-motor-mcp\` conforme a \`spec/PLUGIN_SPEC.md\` (contract ${m.contractVersion}).

## Estructura

- \`plugin.json\` — manifiesto (fuente de verdad).
- \`plugin.manifest.ts\` — envuelve el manifiesto con \`createPlugin()\`.
- \`src/index.tsx\` — la UI que monta el Motor.

## Registrar en el Motor

\`\`\`ts
// plugins/registry.ts del Motor
import { registerPlugins } from "@motor-agentico/plugin-sdk";
import ${camel(m.id)} from "./${m.id}/plugin.manifest";

registerPlugins(${camel(m.id)});
\`\`\`
`;
}

function camel(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// ─── Plantillas para plugins iframe (artefactos Claude / bundles web) ─────────

/** manifest.ts para plugin iframe: no hay Panel React, el Motor monta el bundle. */
export function iframeManifestTs(): string {
  return `import { createPlugin } from "@motor-agentico/plugin-sdk";
import manifest from "./plugin.json";

// Plugin iframe: el Motor monta web/{embed.entry} en un <iframe sandbox>
// y le presta las permissions.capabilities vía el puente postMessage.
export default createPlugin(manifest as Parameters<typeof createPlugin>[0]);
`;
}

/**
 * Shim del puente: hace creer al artefacto que sigue en claude.ai.
 * Reexpone window.claude.complete y window.motor.search reenviando al host
 * (el Motor) por postMessage. El host resuelve usando el Claude ya configurado.
 */
export function bridgeShim(): string {
  return `<script>
  // ── Puente de capacidades del Motor (postMessage) ──────────────────────
  (function () {
    function bridge(method, params) {
      return new Promise(function (resolve, reject) {
        var reqId = method + ":" + Date.now() + ":" + (bridge._n = (bridge._n || 0) + 1);
        function onMsg(e) {
          var d = e.data;
          if (!d || !d.__motorBridge || d.reqId !== reqId) return;
          window.removeEventListener("message", onMsg);
          d.error ? reject(new Error(d.error)) : resolve(d.result);
        }
        window.addEventListener("message", onMsg);
        parent.postMessage({ __motorBridge: true, reqId: reqId, method: method, params: params }, "*");
      });
    }
    // API que esperan los artefactos de Claude:
    window.claude = window.claude || {};
    window.claude.complete = function (prompt, opts) {
      return bridge("claude.complete", Object.assign({ prompt: prompt }, opts || {}));
    };
    // Búsqueda web prestada por el host:
    window.motor = { search: function (q) { return bridge("web.search", { query: q }); } };
  })();
</script>`;
}

/** index.html que aloja el código del artefacto + el shim del puente. */
export function artifactIndexHtml(
  m: PluginManifest,
  code: string,
  runtime: "html" | "react",
): string {
  if (runtime === "html") {
    // El artefacto ya es HTML. Inyectamos el shim antes de su </head> o al inicio.
    if (/<\/head>/i.test(code)) {
      return code.replace(/<\/head>/i, `${bridgeShim()}\n</head>`);
    }
    return `<!doctype html><html><head><meta charset="utf-8">${bridgeShim()}</head><body>\n${code}\n</body></html>`;
  }
  // Artefacto React (JSX). Lo transpilamos en el navegador con Babel standalone.
  // Convención: el componente raíz se llama App (los artefactos suelen exportarlo
  // por default; el importador renombra `export default function X` → `function App`).
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${m.name}</title>
  ${bridgeShim()}
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
${code}
    // Render: busca App o el primer componente exportado.
    const __Root = (typeof App !== "undefined" && App) || (typeof Component !== "undefined" && Component);
    if (__Root) ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(__Root));
    else document.getElementById("root").innerHTML =
      '<p style="padding:24px;color:#b91c1c">No encontré un componente <code>App</code>. Renombra el componente raíz a <code>App</code>.</p>';
  </script>
</body>
</html>`;
}

export function artifactReadme(m: PluginManifest, runtime: string): string {
  const caps = m.permissions?.capabilities ?? [];
  return `# ${m.name}

> ${m.description}
> Plugin **iframe** (\`source: artifact\`, runtime: ${runtime}) importado al puerto del Motor Agéntico.

## Cómo funciona

- El Motor monta \`web/${m.embed?.entry ?? "index.html"}\` en un \`<iframe sandbox>\`.
- El artefacto cree que sigue en claude.ai: el **shim del puente** reexpone
  \`window.claude.complete()\`${caps.includes("web.search") ? " y la búsqueda web" : ""}.
- El Motor resuelve esas llamadas con **tu** Claude ya configurado — el usuario
  **no gestiona ninguna API key**.

## Capacidades solicitadas
${caps.length ? caps.map((c) => `- \`${c}\``).join("\n") : "- (ninguna)"}

## Pendiente del lado del Motor
El **puente** (host) que escucha \`postMessage({__motorBridge})\` y llama a Claude
aún se implementa en el Motor (fase del host). Hasta entonces, el plugin se monta
pero las llamadas a Claude quedan a la espera del host.

${runtime === "react" ? "> ⚠️ React: si la pantalla queda en blanco, asegúrate de que el componente raíz se llame `App`." : ""}
`;
}

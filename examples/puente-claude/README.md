# Puente de Claude (el "mayordomo")

> Plugin de fondo (`type: tool`) que **presta Claude del Motor a los plugins-artefacto**.
> Es la pieza que hace que un artefacto de Claude **cobre vida dentro del Motor sin API keys**.

## Cómo funciona

```
[artefacto en iframe]  ──postMessage──▶  [puente-claude]  ──▶  ctx.host.claude.complete()
   (shim de import_artifact)                (este plugin)        (el Claude del Motor)
                       ◀────── respuesta ──────────────────
```

Usa el gancho **`activate()`** del SDK: al encenderse, registra un listener de
`postMessage` en la ventana del Motor y resuelve las peticiones `claude.complete` /
`web.search` con lo que el Motor le presta vía `ctx.host`.

## Lo que falta para que funcione de verdad

El **cargador del Motor** debe llamar a `activateEnabled(host)` pasando un `host` que
conecte `host.claude.complete` con el Claude real del Motor (Hermes / API). Eso es
parte del montaje en el Motor (toca el Motor una vez). Hasta entonces, este plugin
está listo pero el `host` no tiene a quién llamar.

## Registrar y activar (en el Motor)

```ts
import { registerPlugins, activateEnabled } from "motor-agentico-plugin-sdk";
import puente from "../examples/puente-claude/plugin.manifest";

registerPlugins(puente);
activateEnabled({
  claude: { complete: (prompt) => motorLlamaAClaude(prompt) }, // <- el Motor lo conecta
});
```

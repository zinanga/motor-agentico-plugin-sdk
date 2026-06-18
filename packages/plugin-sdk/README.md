# motor-agentico-plugin-sdk

SDK estándar para construir **plugins del Motor Agéntico**: esquema del manifiesto
(Zod), `createPlugin()`, registry con estado en `localStorage` y hooks de React
(`usePlugin`, `usePluginData`, `useInstalledPlugins`).

Funciona **con o sin Forge**. Parte del repo
[motor-agentico-plugin-sdk](https://github.com/zinanga/motor-agentico-plugin-sdk).

## Instalación

```bash
bun add motor-agentico-plugin-sdk
```

## Uso

```ts
import { createPlugin } from "motor-agentico-plugin-sdk";

export default createPlugin({
  id: "mi-plugin",
  name: "Mi Plugin",
  version: "0.1.0",
  description: "…",
  author: "tú",
  type: "panel",
  surfaces: { sidebar: { label: "Mi Plugin" }, route: { path: "/plugins/mi-plugin" } },
  contractVersion: "1.0",
});
```

Hooks de React:

```ts
import { usePlugin, usePluginData } from "motor-agentico-plugin-sdk/react";
```

El contrato completo está en
[`spec/PLUGIN_SPEC.md`](https://github.com/zinanga/motor-agentico-plugin-sdk/blob/main/spec/PLUGIN_SPEC.md).

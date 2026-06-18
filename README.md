# Motor Agéntico — SDK de Plugins

> Estándar + SDK + MCP para construir **plugins** del Motor Agéntico.
> **Funciona con o sin [Forge](https://lafragua.dev)** — Forge es solo un atajo opcional.

Convierte el patrón de integración hecho a mano (la Porra: `use-porra.ts` + ruta +
sidebar + localStorage) en una **zona de plugins estandarizada**: manifiesto común,
registro, gestor on/off, y un MCP que scaffolda plugins nuevos en segundos.

---

## Qué hay aquí

| Carpeta | Qué es |
|---------|--------|
| `spec/PLUGIN_SPEC.md` | **El estándar.** Reglas de la zona, manifiesto, contrato de datos, ciclo de vida. |
| `packages/plugin-sdk/` | SDK: esquema Zod del manifiesto, `createPlugin()`, registry (localStorage), hooks React (`usePlugin`, `usePluginData`, `useInstalledPlugins`). |
| `mcp/motor-plugin-mcp/` | **MCP arrancador** (independiente de Forge): `scaffold_plugin`, `validate_plugin`, `list_plugins`, `get_plugin_spec`. |
| `examples/personalizador/` | Plugin de ejemplo: **skins/temas del panel** (estilo Warp/IDE), editable en vivo. |

---

## Forge es opcional

El SDK y el MCP son **Bun + TypeScript estándar**, sin dependencia de Forge.

- **Sin Forge:** usa el MCP desde Claude Code (o cualquier MCP host), o copia
  `examples/personalizador` como plantilla a mano. Todo funciona igual.
- **Con Forge:** quien lo tenga puede invocar el MCP desde sus comandos/skills
  como un acelerador — pero nunca es un requisito.

---

## Empezar

```bash
bun install

# Arrancar el MCP (stdio) para probarlo a mano:
bun run mcp
```

### Conectar el MCP a Claude Code

`.mcp.json` (en el Motor o donde desarrolles plugins):

```json
{
  "mcpServers": {
    "motor-plugins": {
      "command": "bun",
      "args": ["run", "/ruta/a/sdk_motor agentico/mcp/motor-plugin-mcp/src/index.ts"]
    }
  }
}
```

Luego, en Claude Code: *"usa get_plugin_spec y scaffold_plugin para crear un plugin
de notas"* → te genera la carpeta conforme al estándar.

---

## Crear un plugin (resumen)

1. `scaffold_plugin` (MCP) o copia `examples/personalizador`.
2. Edita `plugin.json` (`id`, `name`, `type`) y `src/index.tsx`.
3. Regístralo en el Motor:

   ```ts
   import { registerPlugins } from "motor-agentico-plugin-sdk";
   import personalizador from "../examples/personalizador/plugin.manifest";
   registerPlugins(personalizador);
   ```

4. El gestor de plugins del Motor lo lista; el usuario lo instala, configura y
   enciende/apaga.

Ver `spec/PLUGIN_SPEC.md` para el contrato completo.

---

## Integración en el Motor (pendiente)

Lo que falta para conectar esto al Motor Agéntico real (`~/Documents/Motor Agentico`):

- [ ] `plugins/registry.ts` que llame a `registerPlugins(...)`.
- [ ] Ruta dinámica `routes/plugins.$id.tsx` que monte `getPlugin(id).Panel`.
- [ ] Entrada de sidebar generada desde `useInstalledPlugins()`.
- [ ] Página **Gestor de plugins** en Ajustes (instalar / on-off / configurar / quitar).
- [ ] Migrar la Porra a un plugin `neurona` (valida el estándar contra el caso real).

Estado: **fase de ideación** — la base (estándar + SDK + MCP + ejemplo) está lista.

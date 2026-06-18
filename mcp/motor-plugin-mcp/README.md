# @motor-agentico/plugin-mcp

Servidor **MCP arrancador** de plugins del Motor Agéntico. Independiente de Forge:
corre en cualquier MCP host (Claude Code, etc.). Parte del repo
[motor-agentico-plugin-sdk](https://github.com/zinanga/motor-agentico-plugin-sdk).

## Herramientas

| Tool | Qué hace |
|------|----------|
| `get_plugin_spec` | Devuelve el estándar de la Zona de Plugins. |
| `validate_plugin` | Valida un manifiesto contra el estándar. |
| `list_plugins` | Lista los plugins de un directorio. |
| `scaffold_plugin` | Crea un plugin nuevo conforme al spec. |
| `import_artifact` | Artefacto de Claude (código) → plugin iframe con puente de capacidades. |
| `import_zip` | Zip estilo comunidad → manifiesto propuesto. |

## Conectar a Claude Code

`.mcp.json`:

```json
{
  "mcpServers": {
    "motor-plugins": {
      "command": "bunx",
      "args": ["@motor-agentico/plugin-mcp"]
    }
  }
}
```

O en local, apuntando al código: `bun run mcp/motor-plugin-mcp/src/index.ts`.

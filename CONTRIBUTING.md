# Contribuir

¡Gracias por querer mejorar el puerto de plugins del Motor Agéntico! 🔌

Este repo es **open source (MIT)**: puedes usarlo, clonarlo y forkearlo libremente.
La rama `main` está **protegida** — los cambios entran solo vía Pull Request revisada.

## Cómo proponer un cambio

1. Haz **fork** del repo.
2. Crea una rama: `git checkout -b mi-mejora`.
3. Haz tus cambios y verifica que compila:
   ```bash
   bun install
   (cd packages/plugin-sdk && bun run typecheck)
   (cd mcp/motor-plugin-mcp && bun run typecheck)
   ```
4. Abre un **Pull Request** describiendo el qué y el porqué.

Para cambios grandes, abre antes un **Issue** o **Discussion** para alinear el diseño.

## Crear un plugin (no hace falta tocar este repo)

La forma normal de "usarlo" no es modificar el SDK, sino **construir tu plugin**:

- Con el MCP `motor-plugin-mcp` desde Claude Code: `scaffold_plugin`,
  `import_artifact` (artefactos de Claude) o `import_zip`.
- O copiando `examples/personalizador` como plantilla.

Tu plugin vive en **tu** repo/carpeta; este SDK solo aporta el estándar y las herramientas.

## Reglas de la casa

- **No subas datos privados.** Si tu plugin genera datos locales (`data.kind: "local-file"`),
  márcalos `private: true` y mantenlos fuera del control de versiones.
- Sigue el estándar: valida con `validate_plugin` antes de proponer un ejemplo.
- Sé amable. Esto es de la comunidad, para la comunidad.

## Estándar y alcance

El contrato vive en [`spec/PLUGIN_SPEC.md`](spec/PLUGIN_SPEC.md). Cambios al estándar
(nuevos `type`, `data.kind`, `capabilities`…) se discuten en un Issue antes del PR,
porque afectan a todos los plugins.

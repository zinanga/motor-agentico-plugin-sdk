# Manual del skill `crear-neurona` (agnóstico al agente)

Un **skill** es solo Markdown con instrucciones (`SKILL.md`). No es código atado a un
producto: es texto abierto que **cualquier agente capaz de leer skills puede ejecutar**.
Por eso este skill funciona igual en Claude Code, en otro agente, o pegándolo a mano —
gracias al formato abierto de skills de Anthropic.

## Qué hace
Convierte tu idea en una **neurona** (plugin) lista para enchufar al Motor Agéntico,
o en un **artefacto standalone** si no quieres el conector. Tú describes; el agente
genera archivos conformes al estándar y te dice cómo activarlos.

## Cómo usarlo — 3 vías

**A) Claude Code (recomendado)**
1. Copia la carpeta `crear-neurona/` a tus skills:
   - de proyecto: `<tu-proyecto>/.claude/skills/crear-neurona/`, o
   - de usuario: `~/.claude/skills/crear-neurona/`
2. En Claude Code escribe `/crear-neurona` y sigue las preguntas.

**B) Cualquier otro agente que soporte skills**
- Coloca `SKILL.md` donde tu agente busque sus skills e invócalo por su nombre
  (`crear-neurona`). El contenido es estándar Markdown; no depende de Claude Code.

**C) A mano (cualquier chat de IA)**
- Pega el contenido de `SKILL.md` en la conversación y di: *"Sigue estas instrucciones
  para crearme una neurona."* Funciona porque las instrucciones son autónomas.

## Requisitos
- Para **plugins**: tener el SDK del Motor a mano (el skill lee `spec/PLUGIN_SPEC.md`).
  Si además tienes el MCP `motor-plugin-mcp`, el skill lo aprovecha (`scaffold_plugin`,
  `validate_plugin`), pero **no es obligatorio**.
- Para **standalone**: nada — genera un `index.html` autónomo.

## Resultado
- **Plugin:** carpeta `src/plugins/<id>/` lista; se registra en `registry.ts` y aparece
  en **Ajustes → Plugins**. Hereda el tema del panel automáticamente.
- **Standalone:** un `index.html` que abres directo o subes al hub de Artefactos.

> Regla clave que el skill aplica solo: la UI usa **tokens del sistema** (`bg-card`,
> `text-primary`, `border-border`…), nunca colores a fuego. Por eso la neurona se ve
> nativa y se re-tiñe cuando cambias el skin con el Personalizador.

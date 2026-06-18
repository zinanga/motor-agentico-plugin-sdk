# Estado y Decisiones — Puerto de Plugins del Motor Agéntico

> Documento vivo. Última actualización: 2026-06-18.
> Sirve para retomar el proyecto sin perder el hilo.

---

## 1. Qué es esto (en una frase)

Una **capa de plugins estandarizada** para el Motor Agéntico: un estándar + un SDK +
un MCP que permite que cualquiera fabrique "enchufes" (plugins) para el Motor —
incluyendo convertir artefactos de Claude y zips de la comunidad en plugins
gestionables (instalar / encender / apagar).

---

## 2. Qué hemos construido (y dónde está)

**Repo (público, MIT):** https://github.com/zinanga/motor-agentico-plugin-sdk

| Pieza | Carpeta | Qué es |
|------|---------|--------|
| Estándar | `spec/PLUGIN_SPEC.md` | El contrato v1: manifiesto, tipos, datos, embed, capacidades. |
| SDK | `packages/plugin-sdk` | Tipos Zod + `createPlugin()` + registry (localStorage) + hooks React. |
| MCP | `mcp/motor-plugin-mcp` | 6 herramientas (ver abajo). |
| Ejemplo | `examples/personalizador` | Plugin de skins del panel (`type: theme`). |

**Publicado en npm (registro público):**
- `motor-agentico-plugin-sdk@0.1.0` — https://www.npmjs.com/package/motor-agentico-plugin-sdk
- `motor-agentico-plugin-mcp@0.1.0` — https://www.npmjs.com/package/motor-agentico-plugin-mcp

**Herramientas del MCP:** `get_plugin_spec`, `validate_plugin`, `list_plugins`,
`scaffold_plugin`, `import_artifact` (artefacto Claude → plugin iframe con puente),
`import_zip` (zip comunidad → manifiesto propuesto).

**Cómo lo usa cualquiera (cero tokens):**
```jsonc
// .mcp.json
{ "mcpServers": { "motor-plugins": { "command": "bunx", "args": ["motor-agentico-plugin-mcp"] } } }
```

---

## 3. Modelo mental (estilo WordPress)

```
Motor
 └─ cargador de plugins        ← se instala UNA vez (como el "core" de WordPress)
     ├─ plugin: Personalizador
     ├─ plugin: Radar
     ├─ plugin: artefacto de Claude (iframe)
     └─ plugin: EL PUENTE 🛎️   ← el "mayordomo", es un plugin más
```

- **Cargador de plugins:** lo único que se mete en el Motor. Mínimo y aditivo.
  Sin él no hay plugins (igual que WordPress necesita su core para cargar plugins).
- **El puente (host):** el "mayordomo" que escucha a los plugins-artefacto, llama a
  Claude por ellos (con el setup del Motor) y les devuelve la respuesta. Puede ser
  **un plugin de tipo herramienta** con un gancho `activate()` (pendiente en el SDK).

---

## 4. Decisiones tomadas (y por qué)

| Decisión | Por qué |
|----------|---------|
| Independiente de **Forge** | Forge es de pago; no todos lo tienen. SDK/MCP son Bun + TS puro. |
| **Repo propio**, no fork del Motor | El Motor es de Imperio; no se redistribuye su código. El SDK es hermano. |
| Licencia **MIT**, repo público | Máxima adopción; la comunidad usa/forkea sin tocar `main`. |
| Protección **ligera** en `main` | Sin force-push/borrado; el dueño sí puede push. Los de fuera ya no pueden (no tienen escritura). |
| Nombres **sin scope** (`motor-agentico-plugin-*`) | El scope `@motor-agentico` es la org npm de Imperio y `zinanga` no es miembro. |
| Carga **build-time** + manifiesto (v1) | Realista ya. Instalación en caliente = v2. |
| Dos contratos de datos: `neurona-endpoint` y `local-file` | Casos reales: Porra (remoto) y Radar (local privado). |
| `embed: iframe` + `capabilities` + **puente** | Los artefactos de Claude llaman a Claude desde el cliente; el Motor les presta esa capacidad sin API keys. |
| **Bun** para todo; **pnpm** solo para login (npm no) | Preferencia del usuario. Publicar = `bun publish`. |

---

## 5. Los 5 casos reales que guiaron el diseño

1. **Porra** — datos remotos (`neurona-endpoint`).
2. **Radar de Pendientes** (amiga) — ruta nativa + script local; datos privados (`local-file`).
3. **Personalizador** — skin del panel (`type: theme`).
4. **YouTube Analyzer** (moshiscanada) — artefacto React que llama a Claude + web search.
5. **Prospección** — artefacto HTML/JS que llama a Claude.

Patrón dominante: **artefactos que llaman a Claude desde el cliente** → de ahí el puente.

---

## 6. Estado: hecho vs pendiente

**Hecho ✅**
- Estándar v1 cerrado.
- SDK + MCP construidos, compilan y probados (validación, scaffold, import_zip, import_artifact).
- Repo público MIT + publicado en npm.
- **Gancho `activate()`** en el SDK + funciones `activatePlugin`/`deactivatePlugin`/`activateEnabled`. *No toca el Motor.*
- **El puente como plugin** (`examples/puente-claude`, `type: tool`) — el mayordomo, listo a falta del host del Motor.

**Pendiente ⏳**
- **Cargador de plugins** en el Motor (mínimo, aditivo): registrar plugins, montar ruta dinámica, y llamar a `activateEnabled(host)` con un `host` que conecte `host.claude.complete` al Claude real del Motor. *Toca el Motor una vez → hacer `git init` de seguridad antes (el Motor no está bajo git).*
- **Gestor** en el Motor (instalar / on-off / quitar).
- Conversión real del Radar a plugin gestionado (validar el importador con el caso completo).

---

## 7. La cuestión abierta de distribución

**Pregunta:** si modifico solo MI Motor local, ¿esto funciona para otros que no lo
tengan modificado?

**Respuesta corta: no automáticamente.** Ver §8 del chat / siguiente decisión.

- Los paquetes npm son la **herramienta para construir** plugins; **no cambian el Motor de nadie** por sí solos.
- Lo que hace a un Motor "capaz de plugins" es el **cargador**, que vive en el Motor.
- Para que funcione **para todos**, el cargador tiene que llegar a sus Motores:
  - **(a) Oficial:** que Imperio lo meta en el core del Motor → lo reciben todos (modelo WordPress pleno). El usuario es socio → proponerlo.
  - **(b) Add-on:** empaquetar el cargador como instalable (estilo el `install.sh` del Radar) → cada uno lo instala en su Motor, sin depender de Imperio.

### Estrategia elegida: BETA → MERGE (graduación, estilo WordPress)

```
FASE 1 — BETA (opt-in)            FASE 2 — OFICIAL (si Imperio aprueba)
cargador + puente como add-on  →  Imperio lo mergea al core del Motor
cada uno lo instala si quiere     todos lo traen de serie
```

- **Mismo código en ambas fases.** "Mergear" = mover el cargador dentro del Motor oficial; no se rehace nada.
- Empezamos por el **camino (b)** (add-on, no dependemos de nadie) como **beta**.
- Si convence a la comunidad, se propone a Imperio el **camino (a)** (merge al core).
- Reversible: si no convence, ningún Motor oficial quedó tocado.

---

## 8. Próximos pasos sugeridos

1. SDK: añadir el gancho `activate()` (no toca el Motor).
2. Motor (con `git init` de seguridad): cargador + gestor.
3. El puente como plugin.
4. Decidir distribución del cargador: oficial (Imperio) vs add-on instalable.

# Motor Agéntico — Estándar de la Zona de Plugins

> **Contract version:** `1.0` · Estado: **borrador / ideación** · Última edición: 2026-06-18

Este documento define el formato y las reglas para construir **plugins** del
Motor Agéntico. Un plugin es una pieza modular que se enchufa al panel
(una "neurona", un personalizador, una herramienta…) sin tocar el núcleo del Motor.

El objetivo: **que cualquiera construya un plugin con el mismo formato básico**,
lo pueda instalar, verlo en su lista, y encenderlo/apagarlo a voluntad — igual que
hoy funciona la integración de la Porra, pero genérico y reusable.

---

## 1. Principios de la zona

1. **Modular y desactivable.** Todo plugin se puede pausar o quitar sin romper el Motor.
2. **Sin fetch si está apagado.** Un plugin desactivado no hace red, no consume, no pinta.
3. **Estado local del usuario.** La config y el on/off viven en `localStorage`, namespaced por `id`.
4. **Permisos explícitos.** Un plugin declara qué claves de storage y qué dominios de red usa.
5. **Contrato versionado.** Cada manifiesto declara `contractVersion`. El Motor sabe qué soporta.
6. **Tipos primero.** El manifiesto es TypeScript validado con Zod — nada de campos mágicos.

---

## 2. Anatomía de un plugin

```
mi-plugin/
├─ plugin.manifest.ts     # OBLIGATORIO — define el manifiesto (createPlugin)
├─ src/
│  └─ index.tsx           # Punto de entrada de UI (la ruta/panel que pinta)
├─ package.json
└─ README.md
```

El manifiesto es la única parte **obligatoria** y estandarizada. El resto es libre:
conecta con tu código, tu API, tu base de datos o lo que sea.

---

## 3. El manifiesto (`PluginManifest`)

```ts
import { createPlugin } from "@motor-agentico/plugin-sdk";

export default createPlugin({
  id: "porra-mundial-2026",          // único, kebab-case, inmutable
  name: "Mundial 2026",
  version: "1.0.0",                   // semver del plugin
  description: "Tu porra del Mundial dentro del Motor.",
  author: "zinanga",
  icon: "Trophy",                     // nombre de icono lucide-react o URL
  type: "neurona",                    // neurona | panel | theme | tool

  // Dónde aparece dentro del Motor
  surfaces: {
    sidebar: { label: "Mundial 2026", order: 50 },
    route: { path: "/plugins/porra-mundial-2026" },
    homeAlert: true,                  // puede emitir alertas en el home
    settingsPanel: true,              // aparece en el gestor de plugins
  },

  // Formulario de configuración (lo pinta el Motor automáticamente)
  config: [
    { key: "token",  label: "Tu token (UUID del perfil)", type: "string", required: true, secret: true },
    { key: "apiUrl", label: "URL de la API", type: "url", default: "https://porra-imperial-mundial-2026.vercel.app" },
  ],

  // Fuente de datos (opcional). Para el contrato "neurona-endpoint":
  data: {
    kind: "neurona-endpoint",         // GET {apiUrl}/api/neurona/{token}
    auth: "token",
    refreshMs: 300_000,               // 5 min
  },

  // Permisos declarados
  permissions: {
    storageKeys: ["token", "apiUrl"], // se namespacing a motor-plugin:porra-mundial-2026:*
    network: ["porra-imperial-mundial-2026.vercel.app"],
  },

  contractVersion: "1.0",
});
```

### Campos

| Campo | Tipo | Oblig. | Notas |
|-------|------|:--:|-------|
| `id` | `string` | ✅ | Único, kebab-case, `^[a-z0-9][a-z0-9-]{1,48}$`. Inmutable. |
| `name` | `string` | ✅ | Nombre visible. |
| `version` | `semver` | ✅ | Versión del plugin. |
| `description` | `string` | ✅ | Una línea. |
| `author` | `string` | ✅ | Quién lo hace. |
| `icon` | `string` | — | Nombre de icono `lucide-react` o URL. |
| `type` | `enum` | ✅ | `neurona` (datos externos), `panel` (UI propia), `theme` (skin del panel), `tool` (utilidad). |
| `source` | `enum` | — | Procedencia: `native`, `zip`, `artifact`, `endpoint`. La pone el importador. |
| `embed` | `object` | — | Cómo se monta la UI: `{ kind: "component" \| "iframe", entry? }`. Ver §6. |
| `surfaces` | `object` | ✅ | Dónde se monta (sidebar, ruta, alertas, gestor). |
| `config` | `ConfigField[]` | — | Campos del formulario de setup. |
| `data` | `object` | — | Fuente de datos estándar. |
| `permissions` | `object` | — | Storage y red declarados. |
| `contractVersion` | `"1.0"` | ✅ | Versión del contrato que cumple. |

### `ConfigField`

```ts
type ConfigField = {
  key: string;
  label: string;
  type: "string" | "url" | "number" | "boolean" | "select" | "color";
  required?: boolean;
  secret?: boolean;          // se enmascara en la UI
  default?: string | number | boolean;
  options?: { label: string; value: string }[]; // para type "select"
  help?: string;
};
```

---

## 4. Tipos de plugin

| `type` | Para qué | Ejemplo |
|--------|----------|---------|
| `neurona` | Traer datos de un servicio externo y mostrarlos. | Porra Mundial |
| `panel` | Una vista/herramienta propia dentro del Motor. | Notas, kanban personal |
| `theme` | Personalizar el aspecto del panel (skin). | **Personalizador** (ejemplo incluido) |
| `tool` | Utilidad sin UI dedicada (acción, comando). | Exportador, atajo |

---

## 5. Contratos de datos (`data.kind`)

Un plugin puede declarar de dónde saca sus datos. Hay dos contratos. En ambos,
el SDK provee `usePluginData(id)` (TanStack Query, gateado por on/off — sin fetch
si está apagado). El **shape** del JSON es libre por plugin; el SDK solo define el transporte.

### 5.1 `neurona-endpoint` — datos remotos (caso Porra)

```
GET {apiUrl}/api/neurona/{token}
```

- **Auth:** el `token` es el identificador del usuario (p.ej. su UUID).
- **CORS:** `Access-Control-Allow-Origin: *` (el Motor corre en localhost).
- **Cache:** `s-maxage=300, stale-while-revalidate=60` recomendado.
- **Errores:** `{ "error": string }` con el código HTTP correspondiente.

### 5.2 `local-file` — datos locales generados por un script (caso Radar)

El plugin trae un **script generador** que produce un JSON en la máquina del usuario
(p.ej. leyendo `~/.claude/projects`). El Motor lo sirve en `/__plugin/{id}/data`.

```jsonc
"data": { "kind": "local-file", "path": "data.json", "generator": "pendientes.ts", "private": true }
```

- **Privacidad:** si `private: true`, los datos **no se comparten** (van al `.gitignore`).
  Lo que se distribuye es el *script*, nunca su salida.

---

## 6. Plugins iframe y puente de capacidades (artefactos)

Un plugin puede ser un **bundle web aislado** (artefacto de Claude, HTML/JS, export
de Lovable…) en vez de un componente React nativo. Se declara con `embed`:

```jsonc
"embed": { "kind": "iframe", "entry": "index.html" }
```

El Motor lo monta en un `<iframe sandbox>`. Como muchos artefactos **llaman a Claude
desde el cliente** (en claude.ai lo permite `window.claude.complete`), fuera de
claude.ai se romperían. Por eso el plugin **declara las capacidades** que necesita y
el Motor se las presta vía un puente `postMessage`:

```jsonc
"permissions": { "capabilities": ["claude.complete", "web.search"] }
```

```
iframe del plugin   ──postMessage({__motorBridge})──▶   Host de plugins del Motor
  window.claude.complete(...)                            llama a Claude (setup del Motor)
  window.motor.search(...)                               hace la búsqueda
                    ◀──────── resultado ────────────
```

- El importador `import_artifact` inyecta el **shim** del puente en el bundle, así el
  artefacto corre **sin tocar su código** y **sin que el usuario gestione API keys**.
- Aislamiento + permisos explícitos: el iframe solo recibe lo que declaró.

> Regla: `permissions.capabilities` exige `embed.kind: "iframe"` (el puente solo
> aplica a bundles aislados).

---

## 7. Estado y storage (reglas)

Todo el estado del usuario para un plugin se guarda bajo un namespace:

```
motor-plugin:{id}:enabled    → "true" | "false"
motor-plugin:{id}:installed   → "true"  (existe = instalado)
motor-plugin:{id}:config      → JSON con los valores de `config`
```

- **Instalado** = existe la clave `installed` (aparece en el gestor y sidebar).
- **Activo** = instalado **y** `enabled !== "false"` **y** config requerida completa.
- Quitar un plugin borra todas sus claves `motor-plugin:{id}:*`.

El SDK gestiona esto; los plugins no tocan `localStorage` directamente fuera de su namespace.

---

## 8. Ciclo de vida

```
descubrir → instalar → configurar → activar ⇄ pausar → quitar
```

1. **Descubrir:** el plugin está registrado (build-time) en el Motor.
2. **Instalar:** el usuario lo añade desde el gestor (se crea `installed`).
3. **Configurar:** rellena el formulario derivado de `config`.
4. **Activar/Pausar:** toggle on/off (controla el fetch y la UI).
5. **Quitar:** borra el namespace completo.

---

## 9. Reglas de validación (las comprueba el SDK y el MCP)

- `id` único y con formato válido.
- `contractVersion` soportada por el Motor.
- Toda `storageKey` declarada se usa namespaced.
- Todo dominio de red usado está en `permissions.network`.
- Si `data.kind === "neurona-endpoint"`, debe existir un `config` con `token` (y normalmente `apiUrl`).
- Si `permissions.capabilities` tiene entradas, `embed.kind` debe ser `"iframe"`.
- `surfaces.route.path` debe empezar por `/plugins/{id}`.

---

## 10. Roadmap del estándar

- **v1.0 (actual):** plugins build-time; manifiesto + registry + gestor on/off; datos `neurona-endpoint` y `local-file`; tipos `neurona`/`panel`/`theme`/`tool`; `embed` (component/iframe) + `capabilities` declaradas; importadores `import_artifact` / `import_zip`.
- **v1.1:** **host del puente** de capacidades en el Motor (resolver `claude.complete` / `web.search`); marketplace local; import/export de config; firma de manifiesto.
- **v2.0:** instalación **en caliente** desde el personalizador (subir zip/artefacto y montar sin recompilar; permisos en runtime).

---

## 11. Cómo arrancar uno (resumen)

Mediante el MCP **`motor-plugin-mcp`** (independiente de Forge; funciona en
cualquier MCP host, p.ej. Claude Code):

- `get_plugin_spec` → estas reglas.
- `scaffold_plugin` → plugin nuevo desde cero.
- `import_artifact` → artefacto de Claude (código) → plugin iframe con puente.
- `import_zip` → zip estilo comunidad → manifiesto propuesto.

O a mano: copia `examples/personalizador`, edita `plugin.json` + `src/index.tsx`,
y regístralo en el Motor con `registerPlugins(...)`.

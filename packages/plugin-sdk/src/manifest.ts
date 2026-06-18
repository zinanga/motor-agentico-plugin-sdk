/**
 * manifest.ts — Esquema Zod + tipos del manifiesto de plugin.
 *
 * Es la única parte estandarizada y obligatoria de un plugin (ver PLUGIN_SPEC.md).
 * Validamos con Zod para que el Motor y el MCP rechacen manifiestos inválidos.
 */
import { z } from "zod";

/** Versión del contrato que implementa este SDK. */
export const CONTRACT_VERSION = "1.0" as const;

export const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;

export const PluginType = z.enum(["neurona", "panel", "theme", "tool"]);
export type PluginType = z.infer<typeof PluginType>;

export const ConfigFieldType = z.enum([
  "string",
  "url",
  "number",
  "boolean",
  "select",
  "color",
]);

export const ConfigField = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: ConfigFieldType,
  required: z.boolean().optional(),
  secret: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional(),
  help: z.string().optional(),
});
export type ConfigField = z.infer<typeof ConfigField>;

export const Surfaces = z.object({
  sidebar: z
    .object({
      label: z.string().min(1),
      icon: z.string().optional(),
      order: z.number().optional(),
    })
    .optional(),
  route: z
    .object({
      path: z.string().startsWith("/plugins/"),
    })
    .optional(),
  homeAlert: z.boolean().optional(),
  settingsPanel: z.boolean().optional(),
});
export type Surfaces = z.infer<typeof Surfaces>;

/** Datos remotos: GET {apiUrl}/api/neurona/{token} (caso Porra). */
export const NeuronaEndpoint = z.object({
  kind: z.literal("neurona-endpoint"),
  auth: z.literal("token").optional(),
  /** Override del refresco (ms). Default 5 min. */
  refreshMs: z.number().int().positive().optional(),
});

/**
 * Datos locales generados por un script del plugin (caso Radar de Pendientes).
 * El Motor sirve el archivo en /__plugin/{id}/data. Privado: no se comparte.
 */
export const LocalFile = z.object({
  kind: z.literal("local-file"),
  /** Ruta del JSON de datos, relativa a la carpeta de datos del plugin. */
  path: z.string().min(1),
  /** Script generador (informativo): cómo se produce el archivo. */
  generator: z.string().optional(),
  /** Marca los datos como privados (no subir / añadir a .gitignore). */
  private: z.boolean().optional(),
  refreshMs: z.number().int().positive().optional(),
});

/** Fuente de datos del plugin (discriminada por `kind`). */
export const DataSource = z.discriminatedUnion("kind", [NeuronaEndpoint, LocalFile]);
export type DataSource = z.infer<typeof DataSource>;

/** Capacidades que el Motor presta al plugin vía postMessage (puente). */
export const Capability = z.enum(["claude.complete", "web.search"]);
export type Capability = z.infer<typeof Capability>;

export const Permissions = z.object({
  storageKeys: z.array(z.string()).optional(),
  network: z.array(z.string()).optional(),
  /** Capacidades del host que el plugin necesita (p.ej. artefactos que llaman a Claude). */
  capabilities: z.array(Capability).optional(),
});
export type Permissions = z.infer<typeof Permissions>;

/** De dónde vino el plugin (procedencia). */
export const PluginSource = z.enum(["native", "zip", "artifact", "endpoint"]);
export type PluginSource = z.infer<typeof PluginSource>;

/**
 * Cómo se monta la UI:
 *  - "component": el Panel es un componente React del SDK (integración nativa).
 *  - "iframe": un bundle web aislado (artefacto Claude, HTML/JS, export de Lovable…).
 *    El Motor sirve `entry` en un <iframe sandbox> y le presta `permissions.capabilities`.
 */
export const Embed = z.object({
  kind: z.enum(["component", "iframe"]),
  /** Para iframe: archivo de entrada dentro del bundle (default "index.html"). */
  entry: z.string().optional(),
});
export type Embed = z.infer<typeof Embed>;

export const PluginManifest = z
  .object({
    id: z.string().regex(PLUGIN_ID_RE, "id inválido: usa kebab-case (a-z, 0-9, -)"),
    name: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+/, "version debe ser semver"),
    description: z.string().min(1),
    author: z.string().min(1),
    icon: z.string().optional(),
    type: PluginType,
    source: PluginSource.optional(),
    embed: Embed.optional(),
    surfaces: Surfaces,
    config: z.array(ConfigField).optional(),
    data: DataSource.optional(),
    permissions: Permissions.optional(),
    contractVersion: z.literal(CONTRACT_VERSION),
  })
  .superRefine((m, ctx) => {
    // Regla: la ruta debe vivir bajo /plugins/{id}
    if (m.surfaces.route && !m.surfaces.route.path.startsWith(`/plugins/${m.id}`)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["surfaces", "route", "path"],
        message: `route.path debe empezar por /plugins/${m.id}`,
      });
    }
    // (Las capacidades del host valen para cualquier plugin: los iframe las
    // reciben por el puente postMessage; los nativos/tool, por ctx.host.)
    // Regla: neurona-endpoint exige un campo "token" en config
    if (m.data?.kind === "neurona-endpoint") {
      const hasToken = (m.config ?? []).some((c) => c.key === "token");
      if (!hasToken) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["config"],
          message: 'data.kind "neurona-endpoint" requiere un config field con key "token"',
        });
      }
    }
  });

export type PluginManifest = z.infer<typeof PluginManifest>;

/** Resultado de validación legible (lo usa el MCP y el gestor). */
export interface ValidationResult {
  ok: boolean;
  issues: { path: string; message: string }[];
}

export function validateManifest(input: unknown): ValidationResult {
  const res = PluginManifest.safeParse(input);
  if (res.success) return { ok: true, issues: [] };
  return {
    ok: false,
    issues: res.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

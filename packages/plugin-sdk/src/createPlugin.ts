/**
 * createPlugin — define un plugin de forma tipada.
 *
 * Valida el manifiesto en desarrollo (lanza si es inválido) y permite adjuntar
 * el componente de UI que el Motor montará en la ruta del plugin.
 */
import { PluginManifest, validateManifest } from "./manifest";

/**
 * Tipo del componente de UI. Lo dejamos genérico (any) para no acoplar el SDK
 * a una versión concreta de React/JSX; el Motor lo renderiza.
 */
export type PluginComponent = (props?: Record<string, unknown>) => unknown;

/**
 * Capacidades que el Motor (host) presta a los plugins. Las inyecta el cargador
 * del Motor al activar; un plugin nunca trae su propia API key.
 */
export interface PluginHost {
  claude?: {
    complete(prompt: string, opts?: Record<string, unknown>): Promise<string>;
  };
  search?(query: string): Promise<unknown>;
}

/** Contexto que recibe un plugin al activarse. */
export interface PluginContext {
  id: string;
  config: Record<string, unknown>;
  host: PluginHost;
}

/** Función de limpieza que devuelve activate() (se llama al desactivar). */
export type Deactivate = () => void;

export interface PluginDefinition {
  manifest: PluginManifest;
  /** Vista principal que se monta en surfaces.route. Opcional para type "tool". */
  Panel?: PluginComponent;
  /** Para type "theme": aplica/retira el skin. */
  applyTheme?: (config: Record<string, unknown>) => void;
  /**
   * Gancho de arranque (estilo hook de WordPress). Se ejecuta cuando el plugin
   * se activa, en la ventana principal del Motor. Ideal para plugins de fondo
   * (ej: el puente). Puede devolver una función de limpieza.
   */
  activate?: (ctx: PluginContext) => void | Deactivate;
}

export interface CreatePluginInput extends PluginManifest {}

/**
 * Define un plugin. Acepta el manifiesto plano y, opcionalmente, los handlers
 * de UI vía el segundo argumento.
 */
export function createPlugin(
  manifest: CreatePluginInput,
  handlers: Omit<PluginDefinition, "manifest"> = {},
): PluginDefinition {
  const result = validateManifest(manifest);
  if (!result.ok) {
    const detail = result.issues
      .map((i) => `  · ${i.path || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[plugin-sdk] Manifiesto inválido para "${(manifest as { id?: string }).id ?? "?"}":\n${detail}`,
    );
  }
  return {
    manifest: manifest as PluginManifest,
    ...handlers,
  };
}

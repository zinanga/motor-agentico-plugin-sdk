/**
 * registry.ts — Registro de plugins + estado del usuario (localStorage namespaced).
 *
 * Generaliza el patrón de use-porra.ts:
 *   - registro build-time de plugins
 *   - instalado / activo / config gateados por localStorage
 *   - todas las claves bajo el namespace motor-plugin:{id}:*
 */
import type { Deactivate, PluginDefinition, PluginHost } from "./createPlugin";
import type { PluginManifest } from "./manifest";

const NS = "motor-plugin";
const key = (id: string, k: string) => `${NS}:${id}:${k}`;

// --- almacenamiento seguro (no peta en SSR / storage bloqueado) ---
function read(k: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(k) : null;
  } catch {
    return null;
  }
}
function write(k: string, v: string): void {
  try {
    localStorage?.setItem(k, v);
  } catch {
    /* noop */
  }
}
function del(k: string): void {
  try {
    localStorage?.removeItem(k);
  } catch {
    /* noop */
  }
}

// --- registro en memoria ---
const REGISTRY = new Map<string, PluginDefinition>();

/** Registra uno o varios plugins (llamar al arrancar el Motor). */
export function registerPlugins(...plugins: PluginDefinition[]): void {
  for (const p of plugins) REGISTRY.set(p.manifest.id, p);
}

export function getPlugin(id: string): PluginDefinition | undefined {
  return REGISTRY.get(id);
}

/** Todos los plugins registrados (descubribles), ordenados por sidebar.order. */
export function allPlugins(): PluginDefinition[] {
  return [...REGISTRY.values()].sort(
    (a, b) =>
      (a.manifest.surfaces.sidebar?.order ?? 999) -
      (b.manifest.surfaces.sidebar?.order ?? 999),
  );
}

// --- estado por plugin ---
export function isInstalled(id: string): boolean {
  return read(key(id, "installed")) === "true";
}

export function install(id: string): void {
  write(key(id, "installed"), "true");
  if (read(key(id, "enabled")) === null) write(key(id, "enabled"), "true");
}

export function isEnabled(id: string): boolean {
  return read(key(id, "enabled")) !== "false";
}

export function setEnabled(id: string, enabled: boolean): void {
  write(key(id, "enabled"), enabled ? "true" : "false");
}

export function getConfig<T = Record<string, unknown>>(id: string): T {
  const raw = read(key(id, "config"));
  const stored = raw ? safeParse(raw) : {};
  // Mezcla con los defaults declarados en el manifiesto.
  const manifest = REGISTRY.get(id)?.manifest;
  const defaults = manifestDefaults(manifest);
  return { ...defaults, ...stored } as T;
}

export function setConfig(id: string, config: Record<string, unknown>): void {
  write(key(id, "config"), JSON.stringify(config));
}

/** Quita el plugin: borra todo su namespace motor-plugin:{id}:* */
export function uninstall(id: string): void {
  for (const k of ["installed", "enabled", "config"]) del(key(id, k));
}

/**
 * Activo = instalado, no pausado, y con la config requerida completa.
 * (Equivalente a isPorraConfigured() pero genérico.)
 */
export function isActive(id: string): boolean {
  if (!isInstalled(id) || !isEnabled(id)) return false;
  return hasRequiredConfig(id);
}

export function hasRequiredConfig(id: string): boolean {
  const manifest = REGISTRY.get(id)?.manifest;
  if (!manifest?.config) return true;
  const cfg = getConfig(id);
  return manifest.config
    .filter((f) => f.required)
    .every((f) => {
      const v = (cfg as Record<string, unknown>)[f.key];
      return v !== undefined && v !== null && v !== "";
    });
}

// --- helpers ---
function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function manifestDefaults(m?: PluginManifest): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of m?.config ?? []) {
    if (f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}

// --- activación de plugins de fondo (gancho activate) ------------------------
const ACTIVE = new Map<string, Deactivate>();

/**
 * Activa un plugin que tenga gancho `activate()`, pasándole el host del Motor.
 * Idempotente: no reactiva uno ya activo. Lo llama el cargador del Motor.
 */
export function activatePlugin(id: string, host: PluginHost): void {
  if (ACTIVE.has(id)) return;
  const def = REGISTRY.get(id);
  if (!def?.activate || !isActive(id)) return;
  const cleanup = def.activate({ id, config: getConfig(id), host });
  ACTIVE.set(id, typeof cleanup === "function" ? cleanup : () => {});
}

/** Desactiva un plugin de fondo (ejecuta su limpieza). */
export function deactivatePlugin(id: string): void {
  const cleanup = ACTIVE.get(id);
  if (cleanup) {
    cleanup();
    ACTIVE.delete(id);
  }
}

export function isPluginActivated(id: string): boolean {
  return ACTIVE.has(id);
}

/** Activa todos los plugins activos con gancho. Llamar al arrancar el Motor. */
export function activateEnabled(host: PluginHost): void {
  for (const p of allPlugins()) {
    if (isActive(p.manifest.id)) activatePlugin(p.manifest.id, host);
  }
}

/** Construye la URL del endpoint neurona para un plugin de datos remoto. */
export function neuronaUrl(id: string): string | null {
  const cfg = getConfig<Record<string, string>>(id);
  const token = cfg.token;
  const apiUrl = cfg.apiUrl;
  if (!token || !apiUrl) return null;
  return `${apiUrl.replace(/\/$/, "")}/api/neurona/${token}`;
}

/**
 * URL de datos del plugin según su `data.kind`:
 *  - neurona-endpoint → la URL remota {apiUrl}/api/neurona/{token}
 *  - local-file       → el endpoint local que sirve el Motor: /__plugin/{id}/data
 * Devuelve null si el plugin no tiene fuente de datos o falta config.
 */
export function pluginDataUrl(id: string): string | null {
  const data = REGISTRY.get(id)?.manifest.data;
  if (!data) return null;
  if (data.kind === "neurona-endpoint") return neuronaUrl(id);
  if (data.kind === "local-file") return `/__plugin/${id}/data`;
  return null;
}

export { NS as STORAGE_NAMESPACE };

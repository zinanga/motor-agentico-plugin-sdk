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

// Interruptor general de TODA la capa de plugins. Vive en una clave propia
// (`motor-plugin:_module:enabled`) que NO colisiona con ningún plugin (ningún id
// es "_module"). Por tanto apagar/encender la capa NO toca el estado individual
// (installed/enabled/config) de cada plugin → al re-encender todo vuelve EXACTO.
// Ausente = encendido (igual convención que isEnabled).
const MODULE_ID = "_module";
// Clave del respaldo de la capa (lo crea "Desinstalar capa"). No es un plugin.
const BACKUP_ID = "_backup";

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
  for (const p of plugins) {
    const id = p?.manifest?.id;
    if (!id) {
      console.warn("[plugin-sdk] registerPlugins: plugin sin manifest.id, ignorado");
      continue;
    }
    if (REGISTRY.has(id)) {
      console.warn(`[plugin-sdk] registerPlugins: id duplicado "${id}", se reemplaza el anterior`);
    }
    REGISTRY.set(id, p);
  }
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

// --- interruptor general de la capa ---
/** ¿Está encendida la capa de plugins? Ausente = sí. */
export function isModuleEnabled(): boolean {
  return read(key(MODULE_ID, "enabled")) !== "false";
}

/** Enciende/apaga TODA la capa. No toca el estado individual de los plugins. */
export function setModuleEnabled(enabled: boolean): void {
  write(key(MODULE_ID, "enabled"), enabled ? "true" : "false");
}

// --- desinstalar la capa + respaldo (undo) ---
/** Estructura del respaldo. `keys` mapea clave→valor crudo de localStorage. */
export interface LayerBackup {
  version: number;
  savedAt: string; // ISO
  keys: Record<string, string>;
}

const backupKey = () => key(BACKUP_ID, "data");

/** Enumera todas las claves de la capa presentes en localStorage. */
function enumerateLayerKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${NS}:`)) out.push(k);
    }
  } catch {
    /* SSR / storage bloqueado */
  }
  return out;
}

/** Respaldo actual (o null). Para que la UI lo muestre y ofrezca restaurar. */
export function getBackup(): LayerBackup | null {
  const raw = read(backupKey());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LayerBackup;
  } catch {
    return null;
  }
}

/** Descarta el respaldo. */
export function clearBackup(): void {
  del(backupKey());
}

/**
 * Desinstala la capa: respalda TODAS las claves del usuario (`motor-plugin:*`,
 * menos el propio respaldo) y luego las limpia → estado de fábrica. Devuelve el
 * respaldo creado. Seguro: persiste el respaldo ANTES de borrar y verifica que
 * quedó escrito; si no, no borra nada (no se pierde estado).
 */
export function uninstallLayer(): LayerBackup {
  const keys: Record<string, string> = {};
  for (const k of enumerateLayerKeys()) {
    if (k === backupKey()) continue; // no respaldar el respaldo
    const v = read(k);
    if (v !== null) keys[k] = v;
  }
  const backup: LayerBackup = { version: 1, savedAt: new Date().toISOString(), keys };
  write(backupKey(), JSON.stringify(backup));
  if (read(backupKey())) {
    for (const k of Object.keys(keys)) del(k); // respaldo confirmado → limpiar
  }
  return backup;
}

/** Reescribe las claves de la capa desde un respaldo (overwrite 1:1 exacto). */
function applyBackupKeys(keys: Record<string, string>): void {
  for (const k of enumerateLayerKeys()) {
    if (k === backupKey()) continue;
    del(k); // limpia el estado actual para un 1:1 exacto
  }
  for (const [k, v] of Object.entries(keys)) {
    if (typeof k === "string" && k.startsWith(`${NS}:`) && typeof v === "string") write(k, v);
  }
}

/** Restaura desde el respaldo guardado y lo borra. false si no había respaldo. */
export function restoreLayer(): boolean {
  const backup = getBackup();
  if (!backup) return false;
  applyBackupKeys(backup.keys);
  del(backupKey());
  return true;
}

/** Importa un respaldo (objeto de un archivo .json) y lo aplica. */
export function importBackup(backup: LayerBackup): boolean {
  if (!backup || typeof backup !== "object" || !backup.keys) return false;
  applyBackupKeys(backup.keys);
  return true;
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
  if (!isModuleEnabled()) return false; // interruptor general: apaga toda la capa
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
  try {
    const cleanup = def.activate({ id, config: getConfig(id), host });
    ACTIVE.set(id, typeof cleanup === "function" ? cleanup : () => {});
  } catch (err) {
    // Un plugin que peta al activarse NO debe tumbar a los demás.
    console.error(`[plugin-sdk] activate() falló en "${id}":`, err);
  }
}

/** Desactiva un plugin de fondo (ejecuta su limpieza). */
export function deactivatePlugin(id: string): void {
  const cleanup = ACTIVE.get(id);
  if (!cleanup) return;
  try {
    cleanup();
  } catch (err) {
    console.error(`[plugin-sdk] limpieza de "${id}" falló:`, err);
  } finally {
    // Pase lo que pase, lo damos por desactivado.
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

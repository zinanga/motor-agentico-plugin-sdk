/**
 * react.tsx — Hooks de React para consumir plugins desde el Motor.
 *
 * Equivalente genérico de usePorra(): estado del plugin + fetch de datos
 * gateado por on/off, con TanStack Query.
 *
 * react, react-query y zod son peerDependencies — los aporta el Motor.
 */
import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  allPlugins,
  clearBackup,
  getBackup,
  getConfig,
  getPlugin,
  importBackup,
  install,
  isActive,
  isEnabled,
  isInstalled,
  isModuleEnabled,
  pluginDataUrl,
  restoreLayer,
  setConfig,
  setEnabled,
  setModuleEnabled,
  uninstall,
  uninstallLayer,
  type LayerBackup,
} from "./registry";

// Re-render cuando cambia localStorage (otra pestaña o este mismo Motor).
function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener("motor-plugin:change", cb as EventListener);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("motor-plugin:change", cb as EventListener);
  };
}
function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("motor-plugin:change"));
  }
}

/**
 * Estado reactivo del interruptor general de la capa + acción de toggle.
 * `setEnabled` solo voltea el flag y emite el cambio; revertir/re-aplicar los
 * skins (side-effect en el DOM) es responsabilidad del Motor (no del SDK), que
 * reacciona a `enabled` desde el root. SSR: encendido por defecto.
 */
export function usePluginsModule() {
  const enabled = useSyncExternalStore(subscribe, () => isModuleEnabled(), () => true);
  return {
    enabled,
    setEnabled: useCallback((v: boolean) => {
      setModuleEnabled(v);
      emitChange();
    }, []),
  };
}

/**
 * Gestión de toda la capa: desinstalar (limpia + respalda) y recuperar el
 * respaldo (restaurar / descartar / importar). `backup` es reactivo: la UI lo
 * muestra cuando existe y ofrece los botones de recuperación. Las acciones
 * devuelven el estado para que el llamador pueda, p.ej., descargar el .json.
 */
export function usePluginLayer() {
  const savedAt = useSyncExternalStore(subscribe, () => getBackup()?.savedAt ?? "", () => "");
  const backup = savedAt ? getBackup() : null;
  return {
    backup,
    uninstall: useCallback((): LayerBackup => {
      const b = uninstallLayer();
      emitChange();
      return b;
    }, []),
    restore: useCallback(() => {
      restoreLayer();
      emitChange();
    }, []),
    discardBackup: useCallback(() => {
      clearBackup();
      emitChange();
    }, []),
    importBackup: useCallback((b: LayerBackup): boolean => {
      const ok = importBackup(b);
      emitChange();
      return ok;
    }, []),
  };
}

/** Estado reactivo de un plugin concreto + acciones. */
export function usePlugin(id: string) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () =>
      JSON.stringify({
        installed: isInstalled(id),
        enabled: isEnabled(id),
        active: isActive(id),
      }),
    () => JSON.stringify({ installed: false, enabled: true, active: false }),
  );
  const state = JSON.parse(snapshot) as {
    installed: boolean;
    enabled: boolean;
    active: boolean;
  };

  const def = getPlugin(id);

  const actions = {
    install: useCallback(() => {
      install(id);
      emitChange();
    }, [id]),
    setEnabled: useCallback((v: boolean) => {
      setEnabled(id, v);
      emitChange();
    }, [id]),
    saveConfig: useCallback((cfg: Record<string, unknown>) => {
      setConfig(id, cfg);
      emitChange();
    }, [id]),
    remove: useCallback(() => {
      uninstall(id);
      emitChange();
    }, [id]),
  };

  return {
    id,
    manifest: def?.manifest ?? null,
    ...state,
    config: getConfig(id),
    ...actions,
  };
}

/** Lista reactiva de plugins instalados (para el gestor y el sidebar). */
export function useInstalledPlugins() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => allPlugins().map((p) => `${p.manifest.id}:${isInstalled(p.manifest.id)}:${isEnabled(p.manifest.id)}`).join(","),
    () => "",
  );
  void snapshot; // fuerza recomputo en cambios
  return allPlugins().map((p) => ({
    manifest: p.manifest,
    installed: isInstalled(p.manifest.id),
    enabled: isEnabled(p.manifest.id),
    active: isActive(p.manifest.id),
  }));
}

/**
 * Datos de un plugin con fuente declarada (neurona-endpoint remoto o local-file).
 * No hace fetch si el plugin no está activo (equivalente a usePorra()).
 */
export function usePluginData<T = unknown>(id: string) {
  const active = isActive(id);
  const url = pluginDataUrl(id);
  const def = getPlugin(id);
  const refreshMs = def?.manifest.data?.refreshMs ?? 5 * 60_000;

  const query = useQuery<T>({
    queryKey: ["motor-plugin", id, url],
    queryFn: async () => {
      const res = await fetch(url!);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<T>;
    },
    enabled: active && !!url,
    staleTime: refreshMs,
    refetchOnWindowFocus: true,
  });

  return {
    active,
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

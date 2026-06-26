/**
 * motor-agentico-plugin-sdk — punto de entrada.
 *
 * Núcleo sin React (manifiesto + registry). Los hooks viven en "./react"
 * para no obligar a React en consumidores que solo validan manifiestos (p.ej. el MCP).
 */
export * from "./manifest";
export * from "./createPlugin";
export * from "./registry";

import { createPlugin } from "./createPlugin";
import { registerPlugins, install, setConfig, getConfig, isInstalled } from "./registry";

/**
 * Versión del SDK, expuesta para que detectores externos (p.ej. el instalador
 * híbrido de la Porra) puedan reconocer el SDK y reportar "instalando según el
 * SDK vX". Mantener en sync con package.json.
 */
export const SDK_VERSION = "0.1.2";

/**
 * Beacon de capacidad. Al cargarse el SDK (lo que solo ocurre en un Motor que
 * LO TIENE instalado), publica una marca global con su API mínima. Así un
 * detector SIN import estático del paquete (el instalador híbrido de la Porra)
 * puede reconocer el SDK de forma **síncrona y bundler-safe**: si la marca
 * existe → hay SDK; si no (Motor 0.1.0) → modo standalone. No usar import
 * dinámico de un bare specifier para esto: el navegador no lo resolvería.
 */
export interface MotorPluginSdkBeacon {
  version: string;
  createPlugin: typeof createPlugin;
  registerPlugins: typeof registerPlugins;
  install: typeof install;
  setConfig: typeof setConfig;
  getConfig: typeof getConfig;
  isInstalled: typeof isInstalled;
}

export const SDK_BEACON_KEY = "__MOTOR_PLUGIN_SDK__";

if (typeof globalThis !== "undefined") {
  (globalThis as Record<string, unknown>)[SDK_BEACON_KEY] ??= {
    version: SDK_VERSION,
    createPlugin,
    registerPlugins,
    install,
    setConfig,
    getConfig,
    isInstalled,
  } satisfies MotorPluginSdkBeacon;
}

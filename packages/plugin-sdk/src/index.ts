/**
 * motor-agentico-plugin-sdk — punto de entrada.
 *
 * Núcleo sin React (manifiesto + registry). Los hooks viven en "./react"
 * para no obligar a React en consumidores que solo validan manifiestos (p.ej. el MCP).
 */
export * from "./manifest";
export * from "./createPlugin";
export * from "./registry";

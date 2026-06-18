import { createPlugin } from "motor-agentico-plugin-sdk";
import manifest from "./plugin.json";
import { Panel, applyTheme } from "./src/index";

export default createPlugin(manifest as Parameters<typeof createPlugin>[0], {
  Panel,
  applyTheme: (config) => applyTheme(config as Record<string, never>),
});

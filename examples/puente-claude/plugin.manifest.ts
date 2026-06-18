import { createPlugin } from "motor-agentico-plugin-sdk";
import manifest from "./plugin.json";
import { activate } from "./src/index";

export default createPlugin(manifest as Parameters<typeof createPlugin>[0], {
  activate,
});

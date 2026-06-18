import { beforeEach, expect, mock, test } from "bun:test";
import { createPlugin } from "../src/createPlugin";
import * as reg from "../src/registry";

// localStorage en memoria (no existe en el runtime de test).
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

const panel = (id: string, handlers = {}) =>
  createPlugin(
    {
      id,
      name: id,
      version: "0.1.0",
      description: "d",
      author: "a",
      type: "panel",
      surfaces: { route: { path: `/plugins/${id}` } },
      contractVersion: "1.0",
    },
    handlers,
  );

test("install / isInstalled / uninstall limpia el namespace", () => {
  reg.registerPlugins(panel("p-install"));
  expect(reg.isInstalled("p-install")).toBe(false);
  reg.install("p-install");
  expect(reg.isInstalled("p-install")).toBe(true);
  reg.setConfig("p-install", { x: 1 });
  reg.uninstall("p-install");
  expect(reg.isInstalled("p-install")).toBe(false);
  expect(reg.isActive("p-install")).toBe(false);
});

test("on/off controla isActive", () => {
  reg.registerPlugins(panel("p-onoff"));
  reg.install("p-onoff");
  expect(reg.isActive("p-onoff")).toBe(true);
  reg.setEnabled("p-onoff", false);
  expect(reg.isActive("p-onoff")).toBe(false);
  reg.setEnabled("p-onoff", true);
  expect(reg.isActive("p-onoff")).toBe(true);
});

test("config requerida bloquea isActive hasta completarse", () => {
  reg.registerPlugins(
    createPlugin({
      id: "p-cfg",
      name: "x",
      version: "0.1.0",
      description: "d",
      author: "a",
      type: "neurona",
      surfaces: { route: { path: "/plugins/p-cfg" } },
      config: [{ key: "token", label: "T", type: "string", required: true }],
      data: { kind: "neurona-endpoint" },
      contractVersion: "1.0",
    }),
  );
  reg.install("p-cfg");
  expect(reg.isActive("p-cfg")).toBe(false);
  reg.setConfig("p-cfg", { token: "abc" });
  expect(reg.isActive("p-cfg")).toBe(true);
});

test("getConfig mezcla defaults del manifiesto", () => {
  reg.registerPlugins(
    createPlugin({
      id: "p-def",
      name: "x",
      version: "0.1.0",
      description: "d",
      author: "a",
      type: "panel",
      surfaces: { route: { path: "/plugins/p-def" } },
      config: [{ key: "color", label: "c", type: "color", default: "#fff" }],
      contractVersion: "1.0",
    }),
  );
  expect(reg.getConfig("p-def")).toEqual({ color: "#fff" });
  reg.setConfig("p-def", { color: "#000" });
  expect(reg.getConfig("p-def")).toEqual({ color: "#000" });
});

test("activate / deactivate: ciclo completo e idempotente", () => {
  let activated = 0;
  let cleaned = 0;
  reg.registerPlugins(
    panel("p-act", { activate: () => { activated++; return () => { cleaned++; }; } }),
  );
  reg.install("p-act");
  reg.activatePlugin("p-act", {});
  expect(activated).toBe(1);
  expect(reg.isPluginActivated("p-act")).toBe(true);
  reg.activatePlugin("p-act", {}); // segundo activate no repite
  expect(activated).toBe(1);
  reg.deactivatePlugin("p-act");
  expect(cleaned).toBe(1);
  expect(reg.isPluginActivated("p-act")).toBe(false);
});

test("un activate() que peta NO tumba a los demás", () => {
  const spy = mock(() => {});
  const orig = console.error;
  console.error = spy;
  reg.registerPlugins(panel("p-bad", { activate: () => { throw new Error("boom"); } }));
  reg.registerPlugins(panel("p-good", { activate: () => {} }));
  reg.install("p-bad");
  reg.install("p-good");
  expect(() => reg.activateEnabled({})).not.toThrow();
  expect(reg.isPluginActivated("p-bad")).toBe(false);
  expect(reg.isPluginActivated("p-good")).toBe(true);
  console.error = orig;
});

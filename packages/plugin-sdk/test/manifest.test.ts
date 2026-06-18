import { expect, test } from "bun:test";
import { validateManifest } from "../src/manifest";

const base = {
  id: "demo",
  name: "Demo",
  version: "0.1.0",
  description: "d",
  author: "a",
  type: "panel",
  surfaces: { route: { path: "/plugins/demo" } },
  contractVersion: "1.0",
};

test("manifiesto válido pasa", () => {
  expect(validateManifest(base).ok).toBe(true);
});

test("falta un campo obligatorio → inválido", () => {
  const { name, ...noName } = base;
  expect(validateManifest(noName).ok).toBe(false);
});

test("id con mayúsculas → inválido", () => {
  expect(validateManifest({ ...base, id: "Demo" }).ok).toBe(false);
});

test("ruta fuera de /plugins/{id} → inválido", () => {
  const r = validateManifest({ ...base, surfaces: { route: { path: "/otra/demo" } } });
  expect(r.ok).toBe(false);
  expect(r.issues.some((i) => i.path.includes("route"))).toBe(true);
});

test("neurona-endpoint sin token → inválido", () => {
  const r = validateManifest({
    ...base,
    type: "neurona",
    data: { kind: "neurona-endpoint" },
  });
  expect(r.ok).toBe(false);
});

test("neurona-endpoint con token → válido", () => {
  const r = validateManifest({
    ...base,
    type: "neurona",
    config: [{ key: "token", label: "T", type: "string", required: true }],
    data: { kind: "neurona-endpoint" },
  });
  expect(r.ok).toBe(true);
});

test("local-file → válido", () => {
  const r = validateManifest({
    ...base,
    data: { kind: "local-file", path: "data.json", private: true },
  });
  expect(r.ok).toBe(true);
});

test("capacidades en un tool (sin iframe) → válido", () => {
  const r = validateManifest({
    id: "puente",
    name: "Puente",
    version: "0.1.0",
    description: "d",
    author: "a",
    type: "tool",
    surfaces: { settingsPanel: true },
    permissions: { capabilities: ["claude.complete"] },
    contractVersion: "1.0",
  });
  expect(r.ok).toBe(true);
});

test("contractVersion incorrecta → inválido", () => {
  expect(validateManifest({ ...base, contractVersion: "9.9" }).ok).toBe(false);
});

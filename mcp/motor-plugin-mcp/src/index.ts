#!/usr/bin/env bun
/**
 * motor-plugin-mcp — servidor MCP "arrancador" de plugins del Motor Agéntico.
 * Independiente de Forge: corre en cualquier MCP host (Claude Code, etc.).
 *
 * Herramientas:
 *   - get_plugin_spec     → reglas de la zona de plugins (el estándar)
 *   - scaffold_plugin     → crea un plugin conforme al spec
 *   - validate_plugin     → valida un manifiesto (objeto o ruta a plugin.json)
 *   - list_plugins        → lista los plugins de un directorio
 *
 * Pensado para ejecutarse con Bun sobre stdio desde Claude Code / cualquier MCP host.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACT_VERSION,
  validateManifest,
  type PluginManifest,
} from "motor-agentico-plugin-sdk";
import {
  artifactIndexHtml,
  artifactReadme,
  iframeManifestTs,
  manifestJson,
  manifestTs,
  panelTsx,
  pkgJson,
  readme,
} from "./templates.js";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(HERE, "../../../spec/PLUGIN_SPEC.md");

const server = new McpServer({
  name: "motor-plugin-mcp",
  version: "0.1.0",
});

// --- get_plugin_spec ---------------------------------------------------------
server.tool(
  "get_plugin_spec",
  "Devuelve el estándar de la Zona de Plugins del Motor Agéntico (reglas, manifiesto, contrato de datos). Léelo antes de crear un plugin.",
  {},
  async () => {
    const spec = existsSync(SPEC_PATH)
      ? await readFile(SPEC_PATH, "utf8")
      : `Contract version ${CONTRACT_VERSION}. (spec/PLUGIN_SPEC.md no encontrado en ${SPEC_PATH})`;
    return { content: [{ type: "text", text: spec }] };
  },
);

// --- validate_plugin ---------------------------------------------------------
server.tool(
  "validate_plugin",
  "Valida un manifiesto de plugin contra el estándar. Pasa el objeto en `manifest` o una ruta a plugin.json en `path`.",
  {
    manifest: z.record(z.unknown()).optional(),
    path: z.string().optional(),
  },
  async ({ manifest, path }) => {
    let obj = manifest;
    if (!obj && path) {
      const p = resolve(process.cwd(), path);
      obj = JSON.parse(await readFile(p, "utf8"));
    }
    if (!obj) {
      return {
        isError: true,
        content: [{ type: "text", text: "Falta `manifest` o `path`." }],
      };
    }
    const res = validateManifest(obj);
    const text = res.ok
      ? "✅ Manifiesto válido."
      : "❌ Inválido:\n" +
        res.issues.map((i) => `  · ${i.path || "(root)"}: ${i.message}`).join("\n");
    return { isError: !res.ok, content: [{ type: "text", text }] };
  },
);

// --- scaffold_plugin ---------------------------------------------------------
server.tool(
  "scaffold_plugin",
  "Crea un plugin nuevo conforme al estándar (plugin.json + plugin.manifest.ts + src/index.tsx + package.json + README). Devuelve los archivos escritos.",
  {
    id: z.string().describe("kebab-case único, p.ej. mis-notas"),
    name: z.string(),
    description: z.string(),
    author: z.string(),
    type: z.enum(["neurona", "panel", "theme", "tool"]).default("panel"),
    icon: z.string().optional(),
    sidebarLabel: z.string().optional(),
    /** Para type neurona: dominio por defecto de la API. */
    apiUrl: z.string().optional(),
    outDir: z
      .string()
      .default("examples")
      .describe("Directorio donde crear la carpeta del plugin"),
  },
  async (a) => {
    const manifest: PluginManifest = {
      id: a.id,
      name: a.name,
      version: "0.1.0",
      description: a.description,
      author: a.author,
      ...(a.icon ? { icon: a.icon } : {}),
      type: a.type,
      surfaces: {
        sidebar: { label: a.sidebarLabel ?? a.name },
        ...(a.type !== "tool" ? { route: { path: `/plugins/${a.id}` } } : {}),
        settingsPanel: true,
        ...(a.type === "neurona" ? { homeAlert: true } : {}),
      },
      ...(a.type === "neurona"
        ? {
            config: [
              { key: "token", label: "Tu token", type: "string", required: true, secret: true },
              {
                key: "apiUrl",
                label: "URL de la API",
                type: "url",
                ...(a.apiUrl ? { default: a.apiUrl } : {}),
              },
            ],
            data: { kind: "neurona-endpoint", auth: "token", refreshMs: 300_000 },
            ...(a.apiUrl ? { permissions: { network: [hostOf(a.apiUrl)], storageKeys: ["token", "apiUrl"] } } : {}),
          }
        : {}),
      contractVersion: CONTRACT_VERSION,
    };

    const check = validateManifest(manifest);
    if (!check.ok) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              "No se pudo generar (manifiesto inválido):\n" +
              check.issues.map((i) => `  · ${i.path}: ${i.message}`).join("\n"),
          },
        ],
      };
    }

    const base = resolve(process.cwd(), a.outDir, a.id);
    if (existsSync(base)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Ya existe ${base}. Elige otro id o borra la carpeta.` }],
      };
    }
    await mkdir(join(base, "src"), { recursive: true });

    const files: Record<string, string> = {
      "plugin.json": manifestJson(manifest),
      "plugin.manifest.ts": manifestTs(manifest),
      "package.json": pkgJson(manifest),
      "README.md": readme(manifest),
      "src/index.tsx": panelTsx(manifest),
    };
    for (const [rel, content] of Object.entries(files)) {
      await writeFile(join(base, rel), content, "utf8");
    }

    return {
      content: [
        {
          type: "text",
          text:
            `✅ Plugin "${a.id}" creado en ${base}\n\n` +
            Object.keys(files).map((f) => `  + ${f}`).join("\n") +
            `\n\nSiguiente paso: regístralo en el Motor con registerPlugins() (ver README del plugin).`,
        },
      ],
    };
  },
);

// --- list_plugins ------------------------------------------------------------
server.tool(
  "list_plugins",
  "Lista los plugins de un directorio (busca carpetas con plugin.json) y valida cada uno.",
  {
    dir: z.string().default("examples").describe("Directorio a escanear"),
  },
  async ({ dir }) => {
    const root = resolve(process.cwd(), dir);
    if (!existsSync(root)) {
      return { content: [{ type: "text", text: `No existe ${root}` }] };
    }
    const entries = await readdir(root, { withFileTypes: true });
    const rows: string[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const manifestPath = join(root, e.name, "plugin.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const m = JSON.parse(await readFile(manifestPath, "utf8")) as PluginManifest;
        const v = validateManifest(m);
        rows.push(
          `${v.ok ? "✅" : "❌"} ${m.id}  ·  ${m.type}  ·  v${m.version}  ·  ${m.name}`,
        );
      } catch (err) {
        rows.push(`⚠️  ${e.name}  ·  plugin.json ilegible (${(err as Error).message})`);
      }
    }
    return {
      content: [
        {
          type: "text",
          text: rows.length ? rows.join("\n") : `Sin plugins en ${root}`,
        },
      ],
    };
  },
);

// --- import_artifact ---------------------------------------------------------
server.tool(
  "import_artifact",
  "Convierte un artefacto de Claude (código React/JSX o HTML que llama a window.claude) en un plugin iframe del Motor, con el shim del puente de capacidades inyectado. Pega el código en `code`.",
  {
    id: z.string().describe("kebab-case único, p.ej. youtube-analyzer"),
    name: z.string(),
    description: z.string(),
    author: z.string(),
    code: z.string().describe("El código fuente del artefacto (JSX o HTML completo)"),
    runtime: z.enum(["react", "html"]).default("react"),
    capabilities: z
      .array(z.enum(["claude.complete", "web.search"]))
      .default(["claude.complete"]),
    icon: z.string().optional(),
    sidebarLabel: z.string().optional(),
    outDir: z.string().default("examples"),
  },
  async (a) => {
    const manifest: PluginManifest = {
      id: a.id,
      name: a.name,
      version: "0.1.0",
      description: a.description,
      author: a.author,
      ...(a.icon ? { icon: a.icon } : {}),
      type: "panel",
      source: "artifact",
      embed: { kind: "iframe", entry: "index.html" },
      surfaces: {
        sidebar: { label: a.sidebarLabel ?? a.name },
        route: { path: `/plugins/${a.id}` },
        settingsPanel: true,
      },
      permissions: { capabilities: a.capabilities },
      contractVersion: CONTRACT_VERSION,
    };

    const check = validateManifest(manifest);
    if (!check.ok) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              "Manifiesto inválido:\n" +
              check.issues.map((i) => `  · ${i.path}: ${i.message}`).join("\n"),
          },
        ],
      };
    }

    const base = resolve(process.cwd(), a.outDir, a.id);
    if (existsSync(base)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Ya existe ${base}.` }],
      };
    }
    await mkdir(join(base, "web"), { recursive: true });
    const files: Record<string, string> = {
      "plugin.json": manifestJson(manifest),
      "plugin.manifest.ts": iframeManifestTs(),
      "package.json": pkgJson(manifest),
      "README.md": artifactReadme(manifest, a.runtime),
      "web/index.html": artifactIndexHtml(manifest, a.code, a.runtime),
    };
    for (const [rel, content] of Object.entries(files)) {
      await writeFile(join(base, rel), content, "utf8");
    }

    return {
      content: [
        {
          type: "text",
          text:
            `✅ Artefacto "${a.id}" importado como plugin iframe en ${base}\n\n` +
            Object.keys(files).map((f) => `  + ${f}`).join("\n") +
            `\n\nCapacidades prestadas por el host: ${a.capabilities.join(", ")}.\n` +
            `El shim del puente ya está inyectado en web/index.html. Falta implementar el host del puente en el Motor.`,
        },
      ],
    };
  },
);

// --- import_zip --------------------------------------------------------------
server.tool(
  "import_zip",
  "Analiza un zip estilo comunidad (install.sh + files/ que se copian al Motor, p.ej. el Radar de Pendientes), detecta qué instala y a qué plugin mapearía, y genera un plugin.json propuesto. No ejecuta install.sh.",
  {
    path: z.string().describe("Ruta al .zip"),
    id: z.string().optional().describe("id del plugin (si se omite, se deriva del zip)"),
  },
  async ({ path, id }) => {
    const zip = resolve(process.cwd(), path);
    if (!existsSync(zip)) {
      return { isError: true, content: [{ type: "text", text: `No existe ${zip}` }] };
    }
    let stage: string;
    let listing: string;
    try {
      stage = mkdtempSync(join(tmpdir(), "motor-zip-"));
      execFileSync("unzip", ["-q", zip, "-d", stage]);
      listing = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" });
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `No pude descomprimir (¿falta 'unzip'?): ${(err as Error).message}` }],
      };
    }

    const entries = listing.split("\n").filter(Boolean);
    const routes = entries.filter((e) => /files\/src\/routes\/.+\.tsx?$/.test(e));
    const scripts = entries.filter((e) => /files\/scripts\/.+\.ts$/.test(e));
    const hasInstall = entries.some((e) => /install\.sh$/.test(e));
    const editsSidebar = entries.some((e) => /app-sidebar/.test(e)) ||
      // o el install.sh menciona el sidebar
      (hasInstall &&
        existsSync(join(stage, entries.find((e) => /install\.sh$/.test(e))!)) &&
        /app-sidebar/.test(
          await readFile(join(stage, entries.find((e) => /install\.sh$/.test(e))!), "utf8").catch(() => ""),
        ));

    const derivedId =
      id ?? (entries[0]?.split("/")[0] || "plugin-importado").replace(/[^a-z0-9-]/g, "-");
    const routeName = routes[0]?.split("/").pop()?.replace(/\.tsx?$/, "");

    const proposal: PluginManifest = {
      id: derivedId,
      name: derivedId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      version: "0.1.0",
      description: `Importado de ${path} (revisar y completar).`,
      author: "comunidad",
      type: "panel",
      source: "zip",
      embed: { kind: "component" },
      surfaces: {
        sidebar: { label: derivedId },
        route: { path: `/plugins/${derivedId}` },
        settingsPanel: true,
      },
      ...(scripts.length
        ? {
            data: {
              kind: "local-file",
              path: "data.json",
              generator: scripts[0].split("/").pop(),
              private: true,
            } as const,
          }
        : {}),
      contractVersion: CONTRACT_VERSION,
    };

    const report = [
      `📦 ${path}`,
      ``,
      `Detectado:`,
      `  · rutas (UI):     ${routes.length ? routes.map((r) => r.split("/").pop()).join(", ") : "—"}`,
      `  · scripts (datos): ${scripts.length ? scripts.map((s) => s.split("/").pop()).join(", ") : "—"}`,
      `  · install.sh:     ${hasInstall ? "sí" : "no"}`,
      `  · edita sidebar:  ${editsSidebar ? "sí (lo reemplaza el manifiesto → no hace falta)" : "no"}`,
      ``,
      `Mapearía a un plugin "${proposal.type}" (source: zip)${routeName ? `, Panel = ${routeName}` : ""}${scripts.length ? `, data: local-file (privado)` : ""}.`,
      ``,
      `plugin.json propuesto:`,
      manifestJson(proposal).trimEnd(),
      ``,
      `Conversión pendiente (manual o futura): la ruta usa createFileRoute + import estático de datos;`,
      `hay que extraer el componente como Panel y cambiar el import por usePluginData("${derivedId}").`,
    ].join("\n");

    return { content: [{ type: "text", text: report }] };
  },
);

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);

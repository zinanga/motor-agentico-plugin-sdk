/**
 * Personalizador — panel para ajustar el skin del Motor en vivo.
 *
 * Usa el SDK (usePlugin) para leer/guardar la config; al guardar, reaplica el tema.
 * UI deliberadamente sencilla (sin shadcn) para que el plugin sea autocontenido;
 * dentro del Motor puedes sustituir los inputs por componentes de la app.
 */
import { useState } from "react";
import { usePlugin } from "motor-agentico-plugin-sdk/react";
import { applyTheme, type ThemeConfig } from "./theme";

const PRESETS: { name: string; cfg: ThemeConfig }[] = [
  { name: "Teal (Imperio)", cfg: { accent: "#2dd4bf", font: "system", density: "comfortable", radius: 12 } },
  { name: "Warp Night", cfg: { accent: "#7c3aed", font: "mono", density: "compact", radius: 8 } },
  { name: "Solar", cfg: { accent: "#f59e0b", font: "serif", density: "comfortable", radius: 16 } },
  { name: "Coral", cfg: { accent: "#fb7185", font: "system", density: "comfortable", radius: 14 } },
];

export function Panel() {
  const plugin = usePlugin("personalizador");
  const [draft, setDraft] = useState<ThemeConfig>(plugin.config as ThemeConfig);

  const update = (patch: Partial<ThemeConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    applyTheme(next); // preview en vivo
  };

  const save = () => {
    plugin.saveConfig(draft);
    applyTheme(draft);
  };

  return (
    <div className="p-6 max-w-xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Personalizador</h1>
        <p className="text-sm text-muted-foreground">
          Ajusta el aspecto del panel. Los cambios se previsualizan al instante.
        </p>
      </header>

      <section className="space-y-3">
        <label className="block text-sm font-medium">Presets</label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => update(p.cfg)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              style={{ borderColor: p.cfg.accent }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <Field label="Color de acento">
          <input
            type="color"
            value={draft.accent}
            onChange={(e) => update({ accent: e.target.value })}
            className="h-9 w-16 rounded border"
          />
        </Field>

        <Field label="Tipografía">
          <select
            value={draft.font}
            onChange={(e) => update({ font: e.target.value as ThemeConfig["font"] })}
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="system">Sistema</option>
            <option value="mono">Mono</option>
            <option value="serif">Serif</option>
          </select>
        </Field>

        <Field label="Densidad">
          <select
            value={draft.density}
            onChange={(e) => update({ density: e.target.value as ThemeConfig["density"] })}
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="comfortable">Cómoda</option>
            <option value="compact">Compacta</option>
          </select>
        </Field>

        <Field label={`Redondeo: ${draft.radius}px`}>
          <input
            type="range"
            min={0}
            max={24}
            value={draft.radius}
            onChange={(e) => update({ radius: Number(e.target.value) })}
          />
        </Field>
      </section>

      <button
        onClick={save}
        className="rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: draft.accent }}
      >
        Guardar skin
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

/** Re-exporta el aplicador para que el Motor lo invoque al arrancar. */
export { applyTheme } from "./theme";

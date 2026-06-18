/**
 * theme.ts — aplica el skin escribiendo CSS variables en :root.
 *
 * Es pura función + side-effect en el DOM. El Motor usa Tailwind v4 con
 * variables CSS, así que basta con sobreescribir unas pocas.
 */
export interface ThemeConfig {
  accent: string;
  font: "system" | "mono" | "serif";
  density: "comfortable" | "compact";
  radius: number;
}

const FONT_STACKS: Record<ThemeConfig["font"], string> = {
  system:
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
};

/** Aplica el tema. Llamar al arrancar el Motor y cada vez que cambia la config. */
export function applyTheme(config: Partial<ThemeConfig>): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const c: ThemeConfig = {
    accent: config.accent ?? "#2dd4bf",
    font: (config.font as ThemeConfig["font"]) ?? "system",
    density: (config.density as ThemeConfig["density"]) ?? "comfortable",
    radius: Number(config.radius ?? 12),
  };

  root.style.setProperty("--primary", c.accent);
  root.style.setProperty("--accent", c.accent);
  root.style.setProperty("--ring", c.accent);
  root.style.setProperty("--radius", `${c.radius}px`);
  root.style.setProperty("--font-sans", FONT_STACKS[c.font]);
  root.style.setProperty(
    "--motor-density",
    c.density === "compact" ? "0.85" : "1",
  );
  root.dataset.motorDensity = c.density;
}

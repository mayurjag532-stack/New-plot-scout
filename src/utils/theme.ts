/* Theme management: light / dark with system default. */

export type Theme = "light" | "dark";

const KEY = "plot-scout-theme";

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* ignore */ }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = t;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("plot-scout-theme-change", { detail: { theme: t } }));
  }
}

/** Apply saved/system theme before first paint (call once at startup). */
export function initTheme() {
  setTheme(getTheme());
}

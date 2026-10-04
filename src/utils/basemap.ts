/* Basemap preference: map (themed CARTO) / satellite (Esri imagery) / hybrid (imagery + labels). */

export type Basemap = "map" | "satellite" | "hybrid";

const KEY = "plot-scout-basemap";

export function getBasemap(): Basemap {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "map" || saved === "satellite" || saved === "hybrid") return saved;
  } catch { /* ignore */ }
  return "map";
}

export function setBasemap(b: Basemap) {
  try { localStorage.setItem(KEY, b); } catch { /* ignore */ }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("plot-scout-basemap-change", { detail: { basemap: b } }));
  }
}

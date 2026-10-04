import { useEffect, useRef, useState } from "react";
import { Basemap, getBasemap, setBasemap } from "../utils/basemap";

const OPTIONS: { value: Basemap; label: string }[] = [
  { value: "map", label: "Map" },
  { value: "satellite", label: "Satellite" },
  { value: "hybrid", label: "Hybrid" },
];

function LayersIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>;
}

/**
 * Map layers — one quiet control that opens a compact picker with a swatch per
 * basemap (Apple Maps / onX pattern). Keeps the map surface clear until asked.
 */
export default function BasemapSwitcher({ align = "right" }: { align?: "left" | "right" }) {
  const [basemap, setCurrent] = useState<Basemap>(() => getBasemap());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: Event) => setCurrent((e as CustomEvent).detail?.basemap || getBasemap());
    window.addEventListener("plot-scout-basemap-change", h);
    return () => window.removeEventListener("plot-scout-basemap-change", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const current = OPTIONS.find((o) => o.value === basemap)!;

  return (
    <div ref={rootRef} className="ps-layers">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Map style: ${current.label}`}
        aria-expanded={open}
        aria-haspopup="true"
        title="Map style"
        className="ps-map-float ps-float-btn"
      >
        <LayersIcon />
      </button>
      {open && (
        <div className={`ps-layers-pop ps-map-float ps-pop ${align === "left" ? "is-left" : ""}`} role="group" aria-label="Basemap style">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { setBasemap(o.value); window.setTimeout(() => setOpen(false), 160); }}
              aria-pressed={basemap === o.value}
              className="ps-layer-opt"
            >
              <span className={`ps-swatch ps-swatch-${o.value}`} aria-hidden="true" />
              <span className="ps-layer-label">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

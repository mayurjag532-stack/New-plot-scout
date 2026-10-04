import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { ThemeTiles, TileNotice } from "./MapView";
import type { TileStatus } from "./MapView";
import BasemapSwitcher from "./BasemapSwitcher";
import type { PropertyRecord, Score } from "../types";
import type { Tone } from "./ui/StatusTag";
import { economics } from "../utils/economics";
import { fmtMoney } from "../utils/format";

export interface PortfolioItem {
  property: PropertyRecord;
  score: Score;
  tone: Tone;
}

/* ------------------------------------------------------------------ */
/* Markers: quiet pills carrying the property's score + decision tone.  */
/* Selected marker grows, elevates and turns forest — unmistakable.     */
/* ------------------------------------------------------------------ */
function markerIcon(item: PortfolioItem, selected: boolean, order?: number) {
  const orderBadge = order
    ? `<span class="ps-marker-order" aria-hidden="true">${order}</span>`
    : "";
  const effectivePrice = economics(item.property.price).effectivePrice;
  const label = fmtMoney(effectivePrice) ?? String(Math.round(item.score.total));
  const title = effectivePrice != null ? "price" : "score";
  return L.divIcon({
    className: "ps-div-icon",
    html: `<div class="ps-marker${selected ? " ps-marker-selected" : ""}" style="position:relative" aria-label="${label} ${title}"><span class="ps-marker-dot tone-${item.tone}"></span><span>${label}</span>${orderBadge}</div>`,
    iconSize: [86, 32],
    iconAnchor: [43, 16]
  });
}

function clusterIcon(count: number) {
  return L.divIcon({
    className: "ps-div-icon",
    html: `<div class="ps-cluster" aria-hidden="true">${count}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

/* Camera choreography: selection glides the camera (spatial 560ms);      */
/* filters never yank it.                                                  */
function CameraRig({
  items,
  selectedId,
  flySignal
}: {
  items: PortfolioItem[];
  selectedId: string | null;
  flySignal: number;
}) {
  const map = useMap();
  const fittedOnce = useRef(false);
  const located = useMemo(
    () => items.filter((i) => i.property.location),
    [items]
  );

  useEffect(() => {
    if (fittedOnce.current || located.length === 0) return;
    fittedOnce.current = true;
    const bounds = L.latLngBounds(located.map((i) => [i.property.location!.lat, i.property.location!.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.18), { animate: !prefersReducedMotion() });
  }, [located, map]);

  useEffect(() => {
    if (flySignal === 0) return;
    const item = items.find((i) => i.property.id === selectedId);
    const loc = item?.property.location;
    if (!loc) return;
    const target: [number, number] = [loc.lat, loc.lng];
    if (prefersReducedMotion()) map.setView(target, Math.max(map.getZoom(), 15));
    else map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.56 });
  }, [flySignal, selectedId, items, map]);

  return null;
}

/* Viewport clustering: greedy 56px grouping, recomputed on move/zoom.   */
function ClusterLayer({
  items,
  selectedId,
  compareMode,
  selectedIds,
  onMarkerClick
}: {
  items: PortfolioItem[];
  selectedId: string | null;
  compareMode: boolean;
  selectedIds: string[];
  onMarkerClick: (id: string) => void;
}) {
  const map = useMap();
  const [version, setVersion] = useState(0);
  const located = useMemo(() => items.filter((i) => i.property.location), [items]);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    map.on("moveend zoomend", bump);
    return () => { map.off("moveend zoomend", bump); };
  }, [map]);

  const clusters = useMemo(() => {
    void version;
    if (located.length === 0) return [];
    const pts = located.map((item) => ({
      item,
      pt: map.latLngToContainerPoint([item.property.location!.lat, item.property.location!.lng])
    }));
    const R = 56;
    const groups: { items: PortfolioItem[]; cx: number; cy: number; lat: number; lng: number }[] = [];
    for (const p of pts) {
      let g = groups.find((gg) => Math.hypot(gg.cx - p.pt.x, gg.cy - p.pt.y) < R);
      if (!g) {
        g = { items: [], cx: p.pt.x, cy: p.pt.y, lat: 0, lng: 0 };
        groups.push(g);
      }
      g.items.push(p.item);
      const n = g.items.length;
      g.cx = (g.cx * (n - 1) + p.pt.x) / n;
      g.cy = (g.cy * (n - 1) + p.pt.y) / n;
    }
    return groups.map((g) => {
      const lat = g.items.reduce((s, i) => s + i.property.location!.lat, 0) / g.items.length;
      const lng = g.items.reduce((s, i) => s + i.property.location!.lng, 0) / g.items.length;
      return { ...g, lat, lng };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located, version, map]);

  return (
    <>
      {clusters.map((c, ci) =>
        c.items.length === 1 ? (
          <Marker
            key={c.items[0].property.id}
            position={[c.items[0].property.location!.lat, c.items[0].property.location!.lng]}
            icon={markerIcon(
              c.items[0],
              selectedId === c.items[0].property.id,
              compareMode ? (selectedIds.includes(c.items[0].property.id) ? selectedIds.indexOf(c.items[0].property.id) + 1 : undefined) : undefined
            )}
            zIndexOffset={selectedId === c.items[0].property.id ? 1000 : 0}
            eventHandlers={{ click: () => onMarkerClick(c.items[0].property.id) }}
            keyboard
            title={c.items[0].property.name}
          />
        ) : (
          <Marker
            key={`cluster-${ci}`}
            position={[c.lat, c.lng]}
            icon={clusterIcon(c.items.length)}
            eventHandlers={{
              click: () => {
                if (prefersReducedMotion()) map.setView([c.lat, c.lng], Math.min(map.getZoom() + 2, 18));
                else map.flyTo([c.lat, c.lng], Math.min(map.getZoom() + 2, 18), { duration: 0.56 });
              }
            }}
            keyboard
            title={`${c.items.length} properties — zoom in`}
          />
        )
      )}
    </>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
}
function LocateIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>;
}

export default function PortfolioMap({
  items,
  selectedId,
  onSelect,
  compareMode,
  selectedIds,
  onToggleSelect,
  search,
  onSearchChange,
  onPickSuggestion,
  className = ""
}: {
  items: PortfolioItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  compareMode: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
  onPickSuggestion: (id: string) => void;
  className?: string;
}) {
  const [flySignal, setFlySignal] = useState(0);
  const [tiles, setTiles] = useState<TileStatus>("loading");
  const [searchFocus, setSearchFocus] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "denied" | "error">("idle");
  const mapRef = useRef<L.Map | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q ? items.filter((i) => i.property.name.toLowerCase().includes(q)) : items;
    return pool.slice(0, 6);
  }, [items, search]);

  function handleMarkerClick(id: string) {
    if (compareMode) { onToggleSelect(id); return; }
    onSelect(id);
    setFlySignal((s) => s + 1);
  }

  function pickSuggestion(id: string) {
    setSearchFocus(false);
    onPickSuggestion(id);
    setFlySignal((s) => s + 1);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) { setGeoState("error"); return; }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeoState("idle");
        const map = mapRef.current;
        if (!map) return;
        const target: [number, number] = [p.coords.latitude, p.coords.longitude];
        if (prefersReducedMotion()) map.setView(target, 15);
        else map.flyTo(target, 15, { duration: 0.56 });
      },
      (err) => setGeoState(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  useEffect(() => {
    if (geoState !== "denied" && geoState !== "error") return;
    const t = window.setTimeout(() => setGeoState("idle"), 3200);
    return () => window.clearTimeout(t);
  }, [geoState]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchFocus(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const locatedCount = items.filter((i) => i.property.location).length;

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-field-line ${className}`} style={{ background: "var(--surface-2)" }}>
      <MapContainer
        center={INDIA_CENTER}
        zoom={5}
        style={{ height: "100%", width: "100%", minHeight: 320 }}
        zoomControl={false}
        ref={mapRef}
      >
        <ThemeTiles onStatus={setTiles} />
        <CameraRig items={items} selectedId={selectedId} flySignal={flySignal} />
        <ClusterLayer
          items={items}
          selectedId={selectedId}
          compareMode={compareMode}
          selectedIds={selectedIds}
          onMarkerClick={handleMarkerClick}
        />
      </MapContainer>
      <div className="ps-tile-notice-low"><TileNotice status={tiles} /></div>

      {/* Floating search — glass, compact until focused (§5, §14) */}
      <div ref={searchBoxRef} className="absolute top-3 left-3 right-3 sm:right-auto sm:w-[340px] z-[500]">
        <div className={`ps-map-float rounded-2xl transition-all ${searchFocus ? "ps-search-pop" : ""}`}>
          <div className="flex items-center gap-2 pl-3.5 pr-2 py-1.5">
            <span className="text-field-muted shrink-0"><SearchIcon /></span>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => window.setTimeout(() => setSearchFocus(false), 120)}
              placeholder="Search plots…"
              aria-label="Search saved properties"
              className="flex-1 min-w-0 !bg-transparent !border-0 !shadow-none text-sm py-2"
            />
            {search && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="w-11 h-11 grid place-items-center rounded-xl text-field-muted hover:text-field-text shrink-0"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          {searchFocus && suggestions.length > 0 && (
            <ul className="border-t border-field-line py-1.5 max-h-56 overflow-auto" role="listbox" aria-label="Matching properties">
              {suggestions.map((s, i) => (
                <li key={s.property.id}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s.property.id)}
                    className="ps-suggest-item w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-field-panel"
                    style={{ animationDelay: `${i * 40}ms` }}
                    role="option"
                    aria-selected={selectedId === s.property.id}
                  >
                    <span className={`ps-marker-dot tone-${s.tone} shrink-0`} />
                    <span className="flex-1 min-w-0 truncate text-sm text-field-text">{s.property.name}</span>
                    <span className="text-xs text-field-muted tabular-nums shrink-0">{Math.round(s.score.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Floating controls: zoom + locate */}
      <div className="absolute right-3 bottom-3 z-[500] flex flex-col gap-2 items-end">
        <BasemapSwitcher />
        <button onClick={locateMe} aria-label={geoState === "locating" ? "Locating…" : "Show my location"} title="Show my location" className="ps-map-float ps-float-btn">
          {geoState === "locating"
            ? <span className="w-4 h-4 rounded-full border-2 border-field-accent border-t-transparent animate-spin" />
            : <LocateIcon />}
        </button>
        <div className="ps-map-float rounded-2xl overflow-hidden flex flex-col">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            aria-label="Zoom in"
            className="w-12 h-12 grid place-items-center text-field-accent text-xl font-medium border-b border-field-line"
          >+</button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            aria-label="Zoom out"
            className="w-12 h-12 grid place-items-center text-field-accent text-xl font-medium"
          >−</button>
        </div>
      </div>

      {/* GPS status — honest, transient (§42) */}
      {(geoState === "denied" || geoState === "error") && (
        <div className="absolute left-3 bottom-3 z-[500] ps-map-float rounded-xl px-3.5 py-2.5 max-w-[260px] ps-fade" role="status">
          <p className="text-xs text-field-text font-medium">{geoState === "denied" ? "Location access denied" : "Location unavailable"}</p>
          <p className="text-[11px] text-field-muted mt-0.5">Enable location in browser settings, or keep exploring saved plots.</p>
        </div>
      )}

      {/* Map caption: quiet context, never noise */}
      <div className="absolute left-3 bottom-3 z-[400] pointer-events-none hidden sm:block">
        <p className="text-[10px] text-field-muted ps-surface-float-soft backdrop-blur px-2 py-1 rounded-md">
          {locatedCount === items.length ? `${items.length} plotted` : `${locatedCount} of ${items.length} plotted`}
        </p>
      </div>
    </div>
  );
}

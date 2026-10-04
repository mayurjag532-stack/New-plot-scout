import { MapContainer, Marker, Circle, Popup, Polyline, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import L from "leaflet";
import { CapturedLocation, MapPoi } from "../types";
import { googleMapsPointUrl } from "../utils/geo";
import { getBasemap } from "../utils/basemap";
import BasemapSwitcher from "./BasemapSwitcher";

// Calm, muted basemap: cartographic clarity without visual noise, so property
// markers, selection and intelligence overlays stay the loudest thing on screen.
export const CALM_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
export const CALM_TILE_URL_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
/* Esri World Imagery — real satellite/aerial tiles, no API key required. */
export const SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
/* Esri reference overlay — boundaries, places and road labels for Hybrid mode. */
export const HYBRID_REF_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
export const HYBRID_TRANSPORT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
export const CALM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
export const SATELLITE_ATTRIBUTION =
  'Imagery &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics';

/** Returns the basemap URL matching the current theme. */
export function calmTileUrl(): string {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark") {
    return CALM_TILE_URL_DARK;
  }
  return CALM_TILE_URL;
}

export type TileStatus = "loading" | "ok" | "offline";

/**
 * Plot marker: a quiet target — halo, ring, core. It reads on vector, dark and
 * satellite basemaps because the ring is always ivory and the halo carries
 * the colour. Inline markup keeps it available offline.
 */
export const plotIcon = L.divIcon({
  className: "ps-div-icon",
  html: `<div class="ps-plot-pin" aria-hidden="true"><span class="ps-plot-halo"></span><span class="ps-plot-core"></span></div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22]
});

const referenceIcon = L.divIcon({
  className: "ps-div-icon",
  html: `<div class="ps-ref-pin" aria-hidden="true"><span></span></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

function Recenter({ lat, lng, smooth }: { lat: number; lng: number; smooth?: boolean }) {
  const map = useMap();
  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (smooth && !reduced) map.panTo([lat, lng], { animate: true, duration: 0.56 });
    else map.setView([lat, lng], map.getZoom());
  }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Interaction can be switched at runtime (hero "Explore" mode) without remounting. */
function Interaction({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard];
    for (const h of handlers) { if (enabled) h.enable(); else h.disable(); }
    map.getContainer().style.cursor = enabled ? "" : "default";
  }, [enabled, map]);
  return null;
}

/** Basemap layer: themed CARTO vector-style tiles, Esri satellite imagery, or
 *  hybrid (imagery + reference labels). Reacts to theme and basemap changes
 *  and reports whether tiles are actually arriving. */
export function ThemeTiles({ onStatus }: { onStatus?: (s: TileStatus) => void }) {
  const map = useMap();
  useEffect(() => {
    const base = L.tileLayer(calmTileUrl(), { attribution: CALM_ATTRIBUTION, maxZoom: 20 });
    const sat = L.tileLayer(SATELLITE_TILE_URL, { attribution: SATELLITE_ATTRIBUTION, maxZoom: 19 });
    const ref = L.tileLayer(HYBRID_REF_URL, { maxZoom: 19 });
    const transport = L.tileLayer(HYBRID_TRANSPORT_URL, { maxZoom: 19 });
    let active: L.TileLayer[] = [];
    let loads = 0, errors = 0, last: TileStatus = "loading";
    const report = (s: TileStatus) => { if (s !== last) { last = s; onStatus?.(s); } };
    const wire = (l: L.TileLayer) => {
      l.on("tileload", () => { loads++; report("ok"); });
      l.on("tileerror", () => { errors++; if (loads === 0 && errors >= 3) report("offline"); });
    };
    [base, sat, ref, transport].forEach(wire);
    const apply = () => {
      const b = getBasemap();
      const dark = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
      for (const l of active) map.removeLayer(l);
      loads = 0; errors = 0; report("loading");
      map.getContainer().dataset.basemap = b;
      if (b === "satellite") {
        sat.addTo(map); active = [sat];
      } else if (b === "hybrid") {
        sat.addTo(map); transport.addTo(map); ref.addTo(map); active = [sat, transport, ref];
      } else {
        base.setUrl(dark ? CALM_TILE_URL_DARK : CALM_TILE_URL);
        base.addTo(map); active = [base];
      }
    };
    apply();
    const onBasemap = () => apply();
    const onTheme = () => { if (getBasemap() === "map") apply(); };
    const onOnline = () => apply();
    window.addEventListener("plot-scout-basemap-change", onBasemap);
    window.addEventListener("plot-scout-theme-change", onTheme);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("plot-scout-basemap-change", onBasemap);
      window.removeEventListener("plot-scout-theme-change", onTheme);
      window.removeEventListener("online", onOnline);
      for (const l of active) map.removeLayer(l);
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Honest tile-failure state: markers and saved data are intact, only imagery is missing. */
export function TileNotice({ status }: { status: TileStatus }) {
  if (status !== "offline") return null;
  return (
    <div className="ps-tile-notice ps-fade" role="status">
      <span className="ps-tile-notice-dot" aria-hidden="true" />
      <div>
        <p>Basemap unavailable</p>
        <small>Offline or blocked. Your saved plots are intact.</small>
      </div>
    </div>
  );
}

// POI category colours tuned for the light basemap — quiet fills, readable strokes.
export const CATEGORY_COLOR: Record<string, string> = {
  road: "#706E68",
  residential: "#263D30",
  sports: "#B9955A",
  education: "#2E7D4F",
  access: "#8A5F1E"
};

export default function MapView({
  location,
  pois = [],
  reference,
  recenterKey,
  height = 320,
  interactive = true,
  showBasemap,
  fill = false,
  zoom = 16,
  rounded = true
}: {
  location: CapturedLocation;
  pois?: MapPoi[];
  /** User-confirmed official-map reference point (never a derived boundary). */
  reference?: { lat: number; lng: number } | null;
  recenterKey?: number;
  height?: number;
  interactive?: boolean;
  /** Show the basemap switcher even when pan/zoom is off (hero). Defaults to `interactive`. */
  showBasemap?: boolean;
  /** Fill the parent instead of using `height`. */
  fill?: boolean;
  zoom?: number;
  rounded?: boolean;
}) {
  const [tiles, setTiles] = useState<TileStatus>("loading");
  const accuracy = location.accuracy ?? 30;
  return (
    <div
      className={`ps-mapview relative overflow-hidden ${rounded ? "rounded-xl border border-field-line" : ""}`}
      style={fill ? { position: "absolute", inset: 0 } : { height }}
    >
      <MapContainer
        center={[location.lat, location.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl
      >
        <ThemeTiles onStatus={setTiles} />
        <Interaction enabled={interactive} />
        {interactive && <ZoomControl position={fill ? "topright" : "bottomleft"} />}
        <Recenter key={recenterKey} lat={location.lat} lng={location.lng} />
        {/* GPS confidence area — what the device reported, not a parcel boundary. */}
        <Circle
          center={[location.lat, location.lng]}
          radius={accuracy}
          pathOptions={{ className: "ps-accuracy-ring", color: "#B9955A", weight: 1.25, dashArray: "4 5", fillColor: "#B9955A", fillOpacity: 0.1 }}
        />
        {reference && (
          <>
            <Polyline positions={[[location.lat, location.lng], [reference.lat, reference.lng]]} pathOptions={{ color: "#F7F3EC", weight: 1.25, dashArray: "2 6", opacity: 0.9 }} />
            <Marker position={[reference.lat, reference.lng]} icon={referenceIcon} keyboard={false} interactive={false} />
          </>
        )}
        <Marker position={[location.lat, location.lng]} icon={plotIcon} keyboard={interactive}>
          <Popup>
            Property location<br />
            <a href={googleMapsPointUrl(location.lat, location.lng)} target="_blank" rel="noreferrer">
              Open in Google Maps
            </a>
          </Popup>
        </Marker>
        {pois.map((poi) => (
          <Circle
            key={poi.id}
            center={[poi.lat, poi.lng]}
            radius={12}
            pathOptions={{
              color: CATEGORY_COLOR[poi.category] ?? "#706E68",
              weight: 1.5,
              fillColor: CATEGORY_COLOR[poi.category] ?? "#706E68",
              fillOpacity: 0.35
            }}
          >
            <Popup>
              <strong>{poi.name}</strong>
              <br />
              {poi.category} &middot; {Math.round(poi.distanceMeters)}m away
            </Popup>
          </Circle>
        ))}
      </MapContainer>
      <TileNotice status={tiles} />
      {(showBasemap ?? interactive) && (
        <div className="absolute right-2 bottom-2 z-[500]">
          <BasemapSwitcher />
        </div>
      )}
    </div>
  );
}

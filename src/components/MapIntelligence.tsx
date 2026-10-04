import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CapturedLocation, MapIntel, MapPoi } from "../types";
import { fetchMapIntel } from "../utils/overpass";
import { formatDistance, googleMapsSearchUrl } from "../utils/geo";
const MapView = lazy(() => import("./MapView"));

const QUICK_SEARCHES = [
  "Main Roads",
  "Highways",
  "Residential Societies",
  "Schools",
  "Colleges",
  "Gyms",
  "Badminton",
  "Pickleball",
  "Sports Clubs",
  "Turf",
  "Parking",
  "Petrol Pumps",
  "Restaurants",
  "Bus Stop"
];

const CATEGORY_DOT: Record<string, string> = { road: "#706E68", residential: "#263D30", sports: "#B9955A", education: "#2E7D4F", access: "#8A5F1E" };

function PoiList({ title, items, emptyLabel, dot }: { title: string; items: MapPoi[]; emptyLabel: string; dot: string }) {
  return (
    <div className="mb-3">
      <p className="text-field-muted text-[11px] font-semibold mb-1.5 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />{title}</p>
      {items.length === 0 ? (
        <p className="text-field-muted text-xs italic pl-3.5">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 6).map((poi) => (
            <li key={poi.id} title={`Source: ${poi.source ?? "OpenStreetMap"} · ${poi.confidence === "high" ? "named map feature" : "unnamed / lower-confidence map feature"}`} className={`ps-poi ${poi.confidence !== "high" ? "is-soft" : ""}`}>
              <span className="text-field-text truncate">{poi.name}</span>
              <span className="shrink-0 text-right tabular-nums">{formatDistance(poi.distanceMeters)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MapIntelligence({
  location,
  intel,
  onIntelUpdated
}: {
  location: CapturedLocation;
  intel: MapIntel;
  onIntelUpdated: (intel: MapIntel) => void;
}) {
  const [loading, setLoading] = useState(false);
  const autoStarted = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!autoStarted.current && intel.status === "not_run") {
      autoStarted.current = true;
      void runAnalysis();
    }
  // Auto-run once for a captured pin; manual re-run remains available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.lat, location.lng]);

  async function runAnalysis(forceRefresh = false) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    try {
      const result = await fetchMapIntel(location.lat, location.lng, intel.radiusMeters || 1500, controller.signal, forceRefresh);
      if (!controller.signal.aborted) onIntelUpdated(result);
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setLoading(false);
    }
  }

  function cancelAnalysis() { activeRequest.current?.abort(); }

  const allPois: MapPoi[] = [
    ...(intel.nearestRoad ? [intel.nearestRoad] : []),
    ...intel.residential,
    ...intel.sports,
    ...intel.education,
    ...intel.access
  ];

  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-[15px] tracking-tight mb-1">Map Intelligence</h3>
      <p className="text-field-muted text-sm mb-3">
        Plot Scout automatically checks mapped roads, major-road access and useful surroundings around this pin. Map-derived signals are indicative, not legal parcel/access verification.
      </p>

      <button
        onClick={() => void runAnalysis(true)}
        disabled={loading}
        className="ps-btn-secondary w-full disabled:opacity-60"
      >
        {loading ? "Analysing surroundings\u2026" : intel.status === "ok" ? "Re-run analysis" : "Run map analysis"}
      </button>
      {loading && <button onClick={cancelAnalysis} className="w-full mt-2 py-2 rounded-lg text-xs text-field-muted border border-field-line">Cancel analysis</button>}

      {intel.status === "failed" && (
        <div className="mt-3 ps-result-state">
          <div><p className="font-display">Result not found</p><small>{intel.errorMessage || "No mapped result could be retrieved right now. Your saved location is safe."}</small></div>
          <button type="button" className="ps-btn-secondary" onClick={() => void runAnalysis(true)} disabled={loading}>Try again</button>
        </div>
      )}

      {(intel.status === "ok" || intel.status === "partial") && (
        <>
          <div className="mt-4">
            <Suspense fallback={<div className="h-[320px] rounded-xl skeleton" aria-label="Loading map" />}><MapView location={location} pois={allPois} recenterKey={intel.fetchedAt ?? 0} /></Suspense>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <div className="ps-intel">
              <div className="ps-intel-cell">
                <p className="text-field-muted text-[10px] uppercase tracking-[.08em]">Nearest road</p>
                <p className="text-field-text text-sm font-semibold mt-1">{intel.nearestRoad ? intel.nearestRoad.name : "None found"}</p>
                <p className="text-field-muted text-xs mt-0.5">{intel.nearestRoad ? `${formatDistance(intel.nearestRoad.distanceMeters)} · straight-line` : "within search radius"}</p>
              </div>
              <div className="ps-intel-cell">
                <p className="text-field-muted text-[10px] uppercase tracking-[.08em]">Nearest major road</p>
                <p className="text-field-text text-sm font-semibold mt-1">{intel.nearestMajorRoad ? intel.nearestMajorRoad.name : "None mapped"}</p>
                <p className="text-field-muted text-xs mt-0.5">{intel.nearestMajorRoad ? `${formatDistance(intel.nearestMajorRoad.distanceMeters)} · straight-line` : "within radius"}</p>
              </div>
              <div className="ps-intel-cell">
                <p className="text-field-muted text-[10px] uppercase tracking-[.08em]">Nearest highway</p>
                <p className="text-field-text text-sm font-semibold mt-1">{intel.nearestHighway ? intel.nearestHighway.name : "None mapped"}</p>
                <p className="text-field-muted text-xs mt-0.5">{intel.nearestHighway ? `${formatDistance(intel.nearestHighway.distanceMeters)} · straight-line` : "Verify on-site — absence isn't proof"}</p>
              </div>
            </div>

            <PoiList title="Residential / customer catchment" items={intel.residential} emptyLabel="No mapped residential features found within the searched radius." dot={CATEGORY_DOT.residential} />
            <PoiList title="Sports / fitness" items={intel.sports} emptyLabel="No mapped sports/fitness facilities found within the searched radius." dot={CATEGORY_DOT.sports} />
            <PoiList title="Schools / colleges" items={intel.education} emptyLabel="No mapped schools/colleges found within the searched radius." dot={CATEGORY_DOT.education} />
            <PoiList title="Access / convenience / food / landmarks" items={intel.access} emptyLabel="No mapped parking, fuel, transport, shops, restaurants, cafes or landmarks found within the searched radius." dot={CATEGORY_DOT.access} />
          </div>
          <p className="text-field-muted text-[10px] mt-1">{intel.status === "partial" ? "Partial map result — one free map layer responded; the missing layer will be retried on refresh. " : ""}Nearby signals sourced from OpenStreetMap / Overpass. Dashed items are unnamed or lower-confidence map features — verify on-site.</p>
        </>
      )}

      <details className="mt-4 border-t border-field-line pt-3">
        <summary className="text-field-text text-sm font-semibold cursor-pointer">Quick Google Maps search around this pin</summary>
        <div className="ps-chiplist">
          {QUICK_SEARCHES.map((label) => (
            <a
              key={label}
              href={googleMapsSearchUrl(location.lat, location.lng, label)}
              target="_blank"
              rel="noreferrer"
              className="ps-chip"
            >
              {label}
            </a>
          ))}
        </div>
      </details>
    </div>
  );
}

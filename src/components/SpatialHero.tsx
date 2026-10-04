import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { PropertyRecord } from "../types";
import { useMedia } from "../hooks";
import BasemapSwitcher from "./BasemapSwitcher";
const MapView = lazy(() => import("./MapView"));

const PHOTO_LABEL: Record<string, string> = {
  front_road: "Front road", plot: "Plot", left_side: "Left side", right_side: "Right side",
  rear: "Rear", surrounding: "Surroundings", access_road: "Access road", documents: "Documents"
};

type View = "aerial" | "photos";

/**
 * Dossier spatial hero — the property seen from above first.
 * Land.id pattern: the aerial/parcel view is the visual anchor, field photos
 * are a second view of the same hero, and the dossier sheet rises over it.
 * Nothing is fabricated: the ring is the device's GPS confidence area, and the
 * dashed reference point only exists if the user saved one from an official map.
 */
export default function SpatialHero({
  property,
  explore,
  onExploreChange
}: {
  property: PropertyRecord;
  explore: boolean;
  onExploreChange: (v: boolean) => void;
}) {
  const hasLoc = Boolean(property.location);
  const hasPhotos = property.photos.length > 0;
  const [view, setView] = useState<View>(hasLoc ? "aerial" : hasPhotos ? "photos" : "aerial");
  const desktop = useMedia("(min-width: 1024px)");
  const stripRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);

  // If a location is captured (or the last photo removed) keep the view valid.
  useEffect(() => {
    if (view === "aerial" && !hasLoc && hasPhotos) setView("photos");
    if (view === "photos" && !hasPhotos) setView("aerial");
  }, [hasLoc, hasPhotos, view]);

  const ref = property.parcelIntel?.parcelLat != null && property.parcelIntel?.parcelLng != null
    ? { lat: property.parcelIntel.parcelLat, lng: property.parcelIntel.parcelLng }
    : null;

  function onScroll() {
    const el = stripRef.current;
    if (!el) return;
    setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }

  const interactive = desktop || explore;

  return (
    <div className={`ps-aerial ${explore ? "is-explore" : ""}`} aria-label="Spatial view of the property">
      {view === "aerial" && hasLoc && (
        <Suspense fallback={<div className="absolute inset-0 skeleton" style={{ borderRadius: 0 }} aria-label="Loading map" />}>
          <MapView
            key={property.id}
            location={property.location!}
            reference={ref}
            fill
            rounded={false}
            interactive={interactive}
            showBasemap={false}
            zoom={17}
          />
        </Suspense>
      )}

      {view === "photos" && hasPhotos && (
        <div className="ps-photostrip" ref={stripRef} onScroll={onScroll} tabIndex={0} aria-label="Field photos">
          {property.photos.map((p) => (
            <figure key={p.id} className="ps-photoslide">
              <img src={p.dataUrl} alt={p.caption || `${PHOTO_LABEL[p.category] ?? "Site"} photo of ${property.name}`} loading="lazy" />
              <figcaption>
                <b>{PHOTO_LABEL[p.category] ?? "Site"}</b>
                <time dateTime={new Date(p.addedAt).toISOString()}>{new Date(p.addedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {!hasLoc && !(view === "photos" && hasPhotos) && (
        <div className="ps-aerial-empty">
          <svg viewBox="0 0 300 224" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {[28, 56, 84, 112, 140, 168, 196].map((y) => (
              <path key={y} d={`M-10 ${y} C 60 ${y - 18}, 120 ${y + 18}, 190 ${y - 10} S 280 ${y + 8}, 320 ${y - 6}`} fill="none" stroke="currentColor" strokeWidth="1" opacity={0.5} />
            ))}
            <circle cx="150" cy="112" r="22" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeDasharray="4 4" />
            <circle cx="150" cy="112" r="4" fill="var(--gold)" />
          </svg>
          <div>
            <p className="font-display">No position yet</p>
            <small>Capture the location on site and the plot appears here, from above.</small>
          </div>
        </div>
      )}

      {/* hero controls */}
      <div className="ps-aerial-controls">
        {hasLoc && hasPhotos ? (
          <div className="ps-map-float ps-seg" role="tablist" aria-label="Hero view">
            <button role="tab" aria-selected={view === "aerial"} onClick={() => setView("aerial")}>Aerial</button>
            <button role="tab" aria-selected={view === "photos"} onClick={() => setView("photos")}>Photos · {property.photos.length}</button>
          </div>
        ) : <span />}
        <div className="ps-aerial-tools">
          {view === "photos" && hasPhotos && property.photos.length > 1 && (
            <span className="ps-map-float ps-count" aria-live="polite">{slide + 1} / {property.photos.length}</span>
          )}
          {view === "aerial" && hasLoc && <BasemapSwitcher />}
          {view === "aerial" && hasLoc && !desktop && (
            <button
              type="button"
              className="ps-map-float ps-float-btn"
              onClick={() => onExploreChange(!explore)}
              aria-pressed={explore}
              aria-label={explore ? "Done exploring map" : "Explore map"}
              title={explore ? "Done" : "Explore"}
            >
              {explore
                ? <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
                : <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PropertyRecord } from "../types";
import { computeScore } from "../utils/scoring";
import { economics } from "../utils/economics";
import { beforeTokenDecision } from "../utils/decision";
import { fmtMoney, fmtRupees, identityLine } from "../utils/format";
import { DecisionTag } from "./ui/StatusTag";
import { ScoreRing } from "./ui/ScoreRing";
import { ThemeTiles } from "./MapView";
import BasemapSwitcher from "./BasemapSwitcher";
import { prefersReducedMotion } from "../hooks";

type Enriched = {
  p: PropertyRecord;
  s: ReturnType<typeof computeScore>;
  e: ReturnType<typeof economics>;
  d: ReturnType<typeof beforeTokenDecision>;
};

const num = (n: number | null | undefined, suffix = "") => (n == null ? "—" : `${Number(n.toFixed(2)).toLocaleString("en-IN")}${suffix}`);
const km = (m: number | null | undefined) => (m == null ? "—" : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);
const tone = (status: string) => (status === "STRONG" ? "good" : status === "REJECT" ? "bad" : status === "INVESTIGATE" ? "warn" : "neutral");

/** One comparable metric. `value` drives the proportional bar; `show` is what is printed. */
interface Metric {
  label: string;
  value: (x: Enriched) => number | null;
  show: (x: Enriched) => string;
  /** scale for the proportional bar: a fixed maximum, or "auto" (largest in the set). Omit for no bar. */
  bar?: number | "auto";
  /** which direction is notable — marks only the best recorded value, never a recommendation */
  best?: { dir: "low" | "high"; tag: string };
  display?: boolean;
}
interface Group { title: string; metrics: Metric[] }

const GROUPS: Group[] = [
  {
    title: "Price",
    metrics: [
      { label: "Effective price", value: (x) => x.e.effectivePrice, show: (x) => fmtMoney(x.e.effectivePrice) ?? "—", bar: "auto", display: true },
      { label: "Total acquisition", value: (x) => x.e.totalAcquisition, show: (x) => fmtRupees(x.e.totalAcquisition) ?? "—" },
      { label: "Against asking", value: (x) => x.e.discountPct, show: (x) => (x.e.discountPct == null ? "—" : x.e.discountPct >= 0 ? `${x.e.discountPct.toFixed(1)}% below` : `${Math.abs(x.e.discountPct).toFixed(1)}% above`) }
    ]
  },
  {
    title: "Area",
    metrics: [
      { label: "Guntha", value: (x) => x.e.areaGuntha, show: (x) => num(x.e.areaGuntha), bar: "auto", display: true },
      { label: "Square feet", value: (x) => x.e.areaSqft, show: (x) => num(x.e.areaSqft && Math.round(x.e.areaSqft)) },
      { label: "Acre", value: (x) => x.e.areaAcre, show: (x) => num(x.e.areaAcre) }
    ]
  },
  {
    title: "Key facts",
    metrics: [
      { label: "Road width", value: (x) => x.p.price.roadWidthFt ?? null, show: (x) => num(x.p.price.roadWidthFt, " ft"), bar: "auto" },
      { label: "Main-road distance", value: (x) => x.p.price.mainRoadDistanceM ?? null, show: (x) => km(x.p.price.mainRoadDistanceM), bar: "auto", best: { dir: "low", tag: "Closest" } },
      { label: "Critical flags", value: (x) => x.s.criticalFlags.length, show: (x) => (x.s.criticalFlags.length ? String(x.s.criticalFlags.length) : "None") },
      { label: "Confidence", value: () => null, show: (x) => x.s.confidence.charAt(0) + x.s.confidence.slice(1).toLowerCase() }
    ]
  },
  {
    title: "Economics",
    metrics: [
      { label: "₹ / sq ft", value: (x) => x.e.perSqft, show: (x) => fmtRupees(x.e.perSqft) ?? "—", bar: "auto", best: { dir: "low", tag: "Lowest" }, display: true },
      { label: "₹ / guntha", value: (x) => x.e.perGuntha, show: (x) => fmtMoney(x.e.perGuntha) ?? "—", bar: "auto" },
      { label: "₹ / acre", value: (x) => x.e.perAcre, show: (x) => fmtMoney(x.e.perAcre) ?? "—", bar: "auto" }
    ]
  },
  {
    title: "Spatial context",
    metrics: [
      { label: "Nearest mapped road", value: (x) => x.p.mapIntel.nearestRoad?.distanceMeters ?? null, show: (x) => km(x.p.mapIntel.nearestRoad?.distanceMeters), bar: "auto" },
      { label: "Nearest major road", value: (x) => x.p.mapIntel.nearestMajorRoad?.distanceMeters ?? null, show: (x) => km(x.p.mapIntel.nearestMajorRoad?.distanceMeters), bar: "auto" },
      { label: "Location", value: (x) => x.s.breakdown.location, show: (x) => `${x.s.breakdown.location}/15`, bar: 15 },
      { label: "Access", value: (x) => x.s.breakdown.access, show: (x) => `${x.s.breakdown.access}/15`, bar: 15 },
      { label: "Infrastructure", value: (x) => x.s.breakdown.infrastructure, show: (x) => `${x.s.breakdown.infrastructure}/15`, bar: 15 },
      { label: "Site condition", value: (x) => x.s.breakdown.siteCondition, show: (x) => `${x.s.breakdown.siteCondition}/15`, bar: 15 }
    ]
  },
  {
    title: "Evidence",
    metrics: [
      { label: "Evidence score", value: (x) => x.s.breakdown.evidence, show: (x) => `${x.s.breakdown.evidence}/10`, bar: 10, best: { dir: "high", tag: "Most" }, display: true },
      { label: "Photos captured", value: (x) => x.p.photos.length, show: (x) => String(x.p.photos.length), bar: "auto" },
      { label: "Legal readiness", value: (x) => x.s.breakdown.legalReadiness, show: (x) => `${x.s.breakdown.legalReadiness}/10`, bar: 10 },
      { label: "Open verification items", value: (x) => x.d.verifyNext.length, show: (x) => String(x.d.verifyNext.length) }
    ]
  }
];

/** Which column(s) hold the best recorded value for a metric (only when values actually differ). */
function bestIds(m: Metric, enriched: Enriched[]): Set<string> {
  if (!m.best) return new Set();
  const vals = enriched.map((x) => ({ id: x.p.id, v: m.value(x) })).filter((x): x is { id: string; v: number } => x.v != null);
  if (vals.length < 2) return new Set();
  const target = m.best.dir === "low" ? Math.min(...vals.map((x) => x.v)) : Math.max(...vals.map((x) => x.v));
  if (vals.every((x) => x.v === target)) return new Set();
  return new Set(vals.filter((x) => x.v === target).map((x) => x.id));
}
function barPct(m: Metric, x: Enriched, enriched: Enriched[]): number | null {
  if (m.bar == null) return null;
  const v = m.value(x);
  if (v == null || v < 0) return null;
  const max = m.bar === "auto" ? Math.max(...enriched.map((y) => Math.max(0, m.value(y) ?? 0))) : m.bar;
  if (!max) return 0;
  return Math.max(2, Math.min(100, (v / max) * 100));
}

/* ---------------- spatial context: every compared plot on one map ---------------- */
function pin(n: number) {
  return L.divIcon({
    className: "ps-div-icon",
    html: `<div class="ps-cmp-pin" aria-hidden="true">${n}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}
function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.invalidateSize();
    if (points.length === 1) map.setView(points[0], 15, { animate: false });
    else map.fitBounds(L.latLngBounds(points).pad(0.3), { animate: !prefersReducedMotion(), maxZoom: 16 });
  }, [map, points]);
  return null;
}
function CompareMap({ enriched }: { enriched: Enriched[] }) {
  const located = enriched.map((x, i) => ({ x, i })).filter(({ x }) => x.p.location);
  const points = useMemo(() => located.map(({ x }) => [x.p.location!.lat, x.p.location!.lng] as [number, number]), [located.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (located.length === 0) return null;
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  return (
    <div className="ps-cmp-map" aria-label="Where the compared plots are">
      <MapContainer center={points[0]} zoom={13} zoomControl={false} scrollWheelZoom={false} dragging={!touch} attributionControl style={{ height: "100%", width: "100%" }}>
        <ThemeTiles />
        <Fit points={points} />
        {located.map(({ x, i }) => (
          <Marker key={x.p.id} position={[x.p.location!.lat, x.p.location!.lng]} icon={pin(i + 1)} keyboard={false} title={x.p.name} />
        ))}
      </MapContainer>
      <div className="absolute right-2.5 bottom-2.5 z-[500]"><BasemapSwitcher /></div>
      {located.length < enriched.length && (
        <p className="ps-cmp-map-note">{enriched.length - located.length} plot{enriched.length - located.length === 1 ? "" : "s"} without a captured position</p>
      )}
    </div>
  );
}

/* ---------------- identity column header ---------------- */
function Identity({ x, n, index, onOpen }: { x: Enriched; n: number; index: number; onOpen?: (id: string) => void }) {
  const photo = x.p.photos[0];
  const where = identityLine(x.p);
  return (
    <div className="ps-cmp-id ps-stagger" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="ps-cmp-thumb" data-empty={!photo}>
        {photo ? <img src={photo.dataUrl} alt="" loading="lazy" /> : (
          <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {[16, 32, 48, 64].map((y) => <path key={y} d={`M-5 ${y} C 30 ${y - 9}, 60 ${y + 9}, 95 ${y - 5} S 125 ${y + 3}, 130 ${y - 2}`} fill="none" stroke="currentColor" strokeWidth=".7" />)}
          </svg>
        )}
        <span className="ps-cmp-num">{n}</span>
      </div>
      <p className="ps-cmp-name font-display">{x.p.name}</p>
      {where && <p className="ps-cmp-where">{where}</p>}
      <div className="ps-cmp-verdict">
        <ScoreRing value={x.s.total} tone={tone(x.s.status) as "good" | "warn" | "bad" | "neutral"} size={38} strokeWidth={4} />
        <DecisionTag id={x.d.id} label={x.d.shortLabel} />
      </div>
      {onOpen && <button type="button" className="ps-cmp-open" onClick={() => onOpen(x.p.id)}>Open dossier <span aria-hidden="true">→</span></button>}
    </div>
  );
}

export default function PropertyComparison({
  properties,
  onClose,
  onOpen
}: {
  properties: PropertyRecord[];
  onClose: () => void;
  onOpen?: (id: string) => void;
}) {
  const enriched: Enriched[] = useMemo(() => properties.map((p) => ({ p, s: computeScore(p), e: economics(p.price), d: beforeTokenDecision(p) })), [properties]);
  const n = enriched.length;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    ref.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", key); };
  }, [onClose]);

  const cols = { gridTemplateColumns: `minmax(150px, 190px) repeat(${n}, minmax(0, 1fr))` } as const;

  return (
    <div className="ps-cmp-scrim ps-fade" onClick={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        className="ps-cmp ps-sheet-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Property comparison"
      >
        <header className="ps-cmp-top">
          <div className="min-w-0">
            <p className="ps-kicker">Compare · {n} plots</p>
            <h2 className="font-display">Side by side</h2>
          </div>
          <button onClick={onClose} aria-label="Close comparison" className="ps-cmp-close">Close</button>
        </header>

        <div className="ps-cmp-scroll">
          <div className="ps-cmp-body">
            <CompareMap enriched={enriched} />

            {/* Identity — sticky column heads on desktop */}
            <div className="ps-cmp-heads" style={cols}>
              <span className="ps-cmp-corner">Plot</span>
              {enriched.map((x, i) => <Identity key={x.p.id} x={x} n={i + 1} index={i} onOpen={onOpen} />)}
            </div>

            {GROUPS.map((g, gi) => (
              <section key={g.title} className="ps-cmp-group" aria-label={g.title}>
                <h3 className="ps-cmp-gtitle font-display"><span>{String(gi + 1).padStart(2, "0")}</span>{g.title}</h3>

                {g.metrics.map((m) => {
                  const best = bestIds(m, enriched);
                  const hasAny = enriched.some((x) => m.value(x) != null || (m.value(x) == null && m.show(x) !== "—"));
                  if (!hasAny) return null;
                  return (
                    <div key={m.label} className="ps-cmp-row">
                      {/* desktop: columns */}
                      <div className="ps-cmp-row-d" style={cols}>
                        <span className="ps-cmp-label">{m.label}</span>
                        {enriched.map((x, i) => {
                          const pct = barPct(m, x, enriched);
                          const isBest = best.has(x.p.id);
                          return (
                            <div key={x.p.id} className={`ps-cmp-cell ${isBest ? "is-best" : ""}`}>
                              <span className={`ps-cmp-val tabular-nums ${m.display ? "font-display is-display" : ""} ${m.show(x) === "—" ? "is-empty" : ""}`}>{m.show(x)}</span>
                              {isBest && <em className="ps-cmp-tag">{m.best!.tag}</em>}
                              {pct != null && <span className="ps-cmp-bar" aria-hidden="true"><i style={{ width: `${pct}%`, animationDelay: `${i * 40}ms` }} /></span>}
                            </div>
                          );
                        })}
                      </div>
                      {/* mobile: one metric, plots stacked beneath it */}
                      <div className="ps-cmp-row-m">
                        <p className="ps-cmp-label">{m.label}</p>
                        <ul>
                          {enriched.map((x, i) => {
                            const pct = barPct(m, x, enriched);
                            const isBest = best.has(x.p.id);
                            return (
                              <li key={x.p.id} className={isBest ? "is-best" : ""}>
                                <span className="ps-cmp-mnum" aria-hidden="true">{i + 1}</span>
                                <span className="ps-cmp-mname">{x.p.name}</span>
                                <span className={`ps-cmp-val tabular-nums ${m.display ? "font-display is-display" : ""} ${m.show(x) === "—" ? "is-empty" : ""}`}>{m.show(x)}</span>
                                {isBest && <em className="ps-cmp-tag">{m.best!.tag}</em>}
                                {pct != null && <span className="ps-cmp-bar" aria-hidden="true"><i style={{ width: `${pct}%`, animationDelay: `${i * 40}ms` }} /></span>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}

            <p className="ps-cmp-foot">Only information recorded in Plot Scout is compared. Markers show the lowest, closest or most complete recorded value — they are not investment recommendations, valuations or legal conclusions.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

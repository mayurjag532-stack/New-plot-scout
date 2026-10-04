import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { PropertyRecord } from "../types";
import { computeScore } from "../utils/scoring";
import { economics } from "../utils/economics";
import { formatDistance, googleMapsPointUrl } from "../utils/geo";
import { getProperty } from "../db";
import { canUse, Plan } from "../entitlements";
import { beforeTokenDecision, BeforeTokenDecision } from "../utils/decision";
import { visitCompletion } from "../utils/visitState";
import { DecisionTag, decisionTone, Tone } from "./ui/StatusTag";
import { ScoreRing } from "./ui/ScoreRing";
import type { PortfolioItem } from "./PortfolioMap";
import PropertySheet from "./PropertySheet";
import InsightsSheet from "./InsightsSheet";
import FilterSheet, { Filters, DEFAULT_FILTERS, activeFilterCount, SortKey } from "./FilterSheet";
import { fmtMoney } from "../utils/format";
const PortfolioMap = lazy(() => import("./PortfolioMap"));
const PropertyComparison = lazy(() => import("./PropertyComparison"));

const STATUS_FILTERS: { id: "ALL" | BeforeTokenDecision; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "PROCEED_TO_VERIFICATION", label: "Proceed" },
  { id: "HOLD_MORE_INFO", label: "Hold / verify" },
  { id: "HIGH_CONCERN", label: "High concern" },
  { id: "INSUFFICIENT_DATA", label: "Insufficient data" }
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "score_desc", label: "Score: high to low" },
  { id: "score_asc", label: "Score: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "area_desc", label: "Area: high to low" },
  { id: "area_asc", label: "Area: low to high" }
];

function relativeTime(ts: number) {
  const s = Math.max(0, Date.now() - ts) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function PinIcon() { return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>; }
function CameraIcon() { return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.2a1 1 0 0 0 .9-.5l.6-1a1 1 0 0 1 .9-.5h4.8a1 1 0 0 1 .9.5l.6 1a1 1 0 0 0 .9.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.2" /></svg>; }
function FlagIcon() { return <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4c4-2.5 8 2.5 12 0v10c-4 2.5-8-2.5-12 0" /></svg>; }
function ChevronIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.9 12.1a2 2 0 0 1-2 1.9H8.9a2 2 0 0 1-2-1.9L6 7" /></svg>; }

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function PropertyList({
  properties,
  onOpen,
  onNew,
  plan,
  onDelete
}: {
  properties: PropertyRecord[];
  onOpen: (id: string) => void;
  onNew: () => void;
  plan: Plan;
  onDelete: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const statusFilter = filters.decision;
  const sortBy: SortKey = filters.sortBy;
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonProperties, setComparisonProperties] = useState<PropertyRecord[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const scored: PortfolioItem[] = useMemo(
    () => properties.map((p) => {
      const score = computeScore(p);
      const decision = beforeTokenDecision(p);
      return { property: p, score, tone: decision.tone as Tone };
    }),
    [properties]
  );

  const priceOf = (p: PropertyRecord) => economics(p.price).effectivePrice ?? p.price.quotedPrice ?? null;
  const matches = (item: PortfolioItem, f: Filters) => {
    const { property } = item;
    const q = search.trim().toLowerCase();
    if (q && !property.name.toLowerCase().includes(q)) return false;
    if (f.decision !== "ALL" && beforeTokenDecision(property).id !== f.decision) return false;
    if (f.price) { const v = priceOf(property); if (v == null || v < f.price[0] || v > f.price[1]) return false; }
    return true;
  };
  const filtered = useMemo(() => scored.filter((it) => matches(it, filters)), [scored, search, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const prices = useMemo(() => properties.map(priceOf).filter((v): v is number => v != null), [properties]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "oldest": return list.sort((a, b) => a.property.createdAt - b.property.createdAt);
      case "score_desc": return list.sort((a, b) => b.score.total - a.score.total);
      case "score_asc": return list.sort((a, b) => a.score.total - b.score.total);
      case "price_desc": return list.sort((a, b) => (b.property.price.quotedPrice ?? -1) - (a.property.price.quotedPrice ?? -1));
      case "price_asc": return list.sort((a, b) => {
        const av = a.property.price.quotedPrice, bv = b.property.price.quotedPrice;
        if (av == null) return 1; if (bv == null) return -1; return av - bv;
      });
      case "area_desc": return list.sort((a, b) => (b.property.price.areaSqft ?? -1) - (a.property.price.areaSqft ?? -1));
      case "area_asc": return list.sort((a, b) => {
        const av = a.property.price.areaSqft, bv = b.property.price.areaSqft;
        if (av == null) return 1; if (bv == null) return -1; return av - bv;
      });
      case "newest":
      default: return list.sort((a, b) => b.property.createdAt - a.property.createdAt);
    }
  }, [filtered, sortBy]);

  /* Portfolio hero stats — computed from existing data only, never invented. */
  const portfolioStats = useMemo(() => {
    let total = 0, priced = 0, perGunthaSum = 0, perGunthaN = 0, scoreSum = 0, flagged = 0;
    for (const { property: p, score } of scored) {
      const e = economics(p.price);
      if (e.effectivePrice != null) { total += e.effectivePrice; priced++; }
      if (e.perGuntha != null) { perGunthaSum += e.perGuntha; perGunthaN++; }
      scoreSum += score.total;
      if (score.criticalFlags.length > 0) flagged++;
    }
    return {
      total,
      priced,
      avgPerGuntha: perGunthaN > 0 ? perGunthaSum / perGunthaN : null,
      avgScore: scored.length > 0 ? Math.round(scoreSum / scored.length) : null,
      flagged,
    };
  }, [scored]);

  function scrollCardIntoView(id: string) {
    requestAnimationFrame(() => {
      cardRefs.current.get(id)?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest"
      });
    });
  }

  function handleSelect(id: string | null) {
    setSelectedId(id);
    if (id) scrollCardIntoView(id);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev);
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelectedIds([]);
    setShowComparison(false);
  }

  function clearFilters() {
    setSearch("");
    setFilters((f) => ({ ...DEFAULT_FILTERS, sortBy: f.sortBy }));
  }

  async function openComparison() {
    if (selectedIds.length < 2 || comparisonLoading) return;
    setComparisonLoading(true);
    try {
      const full = await Promise.all(selectedIds.slice(0, 5).map((id) => getProperty(id)));
      setComparisonProperties(full.filter((p): p is PropertyRecord => Boolean(p)));
      setShowComparison(true);
    } finally { setComparisonLoading(false); }
  }

  const filterKey = `${filters.decision}|${sortBy}|${filters.price?.join("-") ?? ""}`;

  return (
    <div className="px-4 md:px-8 pt-5 md:pt-7 max-w-xl lg:max-w-[1440px] mx-auto pb-28 md:pb-12">
      {/* Portfolio hero — Fundrise-style: one hero value, then quiet context.
          Editorial, not dashboard: no stat-card grid, no pills. */}
      {properties.length > 0 && (
      <section aria-label="Portfolio summary" className="mb-6 md:mb-8 ps-rise">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-[30px] md:text-[36px] leading-none text-field-text">Portfolio</h2>
          <button type="button" onClick={() => setShowInsights(true)} className="ps-link-btn shrink-0" aria-haspopup="dialog">
            Insights <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="mt-6 md:mt-7">
          <p className="ps-kicker">{portfolioStats.priced > 0 ? "Portfolio value" : "Plots tracked"}</p>
          <p className="font-display text-field-text leading-[1.02] mt-2 tabular-nums" style={{ fontSize: "var(--text-hero)" }}>
            {portfolioStats.priced > 0 ? fmtMoney(portfolioStats.total) : String(properties.length)}
          </p>
          <p className="text-field-muted text-[13px] mt-2">
            {portfolioStats.priced > 0
              ? `Across ${properties.length} ${properties.length === 1 ? "plot" : "plots"}${
                  portfolioStats.priced < properties.length
                    ? ` · ${portfolioStats.priced} with price data`
                    : ""
                }`
              : "Add price data during visits to see portfolio value"}
          </p>
        </div>

        <dl className="hidden md:grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-field-line">
          <div>
            <dt className="text-[10px] uppercase tracking-[.1em] text-field-muted font-semibold">Avg ₹/guntha</dt>
            <dd className="font-display text-field-text text-[20px] mt-1 tabular-nums">
              {portfolioStats.avgPerGuntha != null ? fmtMoney(portfolioStats.avgPerGuntha) : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[.1em] text-field-muted font-semibold">Avg score</dt>
            <dd className="font-display text-field-text text-[20px] mt-1 tabular-nums">
              {portfolioStats.avgScore != null ? portfolioStats.avgScore : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[.1em] text-field-muted font-semibold">Flagged</dt>
            <dd className="font-display text-field-text text-[20px] mt-1 tabular-nums">
              {portfolioStats.flagged}
            </dd>
          </div>
        </dl>
      </section>)}

      {properties.length === 0 ? (
        <div className="ps-empty ps-empty-home ps-rise">
          <svg viewBox="0 0 320 180" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M-10 ${24 + i * 24} C 70 ${6 + i * 24}, 130 ${46 + i * 24}, 210 ${20 + i * 24} S 300 ${34 + i * 24}, 330 ${18 + i * 24}`} opacity={0.55} />)}
            <circle cx="160" cy="90" r="46" strokeDasharray="3 5" stroke="var(--gold)" />
            <circle cx="160" cy="90" r="6" fill="var(--gold)" stroke="none" />
          </svg>
          <p className="ps-kicker">Your portfolio</p>
          <p className="font-display">No property visits saved yet</p>
          <small>Start your first visit to capture a location, evidence and a price signal. Plot Scout builds the decision record as you go — everything stays on this device.</small>
          <button onClick={onNew} className="ps-btn-primary">Start a visit</button>
        </div>
      ) : (
        <div className="ps-portfolio-layout lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 lg:items-start">
          {/* Map — a product surface, pinned while cards scroll */}
          <div className="ps-portfolio-map-wrap lg:sticky lg:top-4 pt-1 pb-3 lg:p-0">
            <div className="relative">
              <Suspense fallback={<div className="h-[54dvh] min-h-[340px] lg:h-[calc(100vh-130px)] rounded-3xl border border-field-line skeleton" aria-label="Loading map" />}>
                <PortfolioMap
                  items={sorted}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  compareMode={compareMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelected}
                  search={search}
                  onSearchChange={setSearch}
                  onPickSuggestion={handleSelect}
                  className="h-[54dvh] min-h-[340px] lg:h-[calc(100vh-130px)] shadow-[var(--shadow-md)]"
                />
              </Suspense>
              {sorted.length === 0 && (
                <div className="absolute inset-0 z-[600] grid place-items-center p-6 pointer-events-none">
                  <div className="ps-map-float rounded-3xl p-6 text-center max-w-xs pointer-events-auto ps-sheet-up">
                    <p className="font-display text-field-text text-xl">No matching plots</p>
                    <p className="text-field-muted text-sm mt-1.5">Your current search and filters are too restrictive.</p>
                    <button onClick={clearFilters} className="mt-4 bg-field-accent text-sm font-semibold px-5 py-2.5 rounded-xl">
                      Adjust filters
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Control deck — quiet controls on canvas, not a card. Filters are
              text with an active indicator, never pills. */}
          <div className="ps-portfolio-panel min-w-0">
          <div className="mb-5">
            <div className="ps-fbar">
              <button type="button" className="ps-fbtn" onClick={() => setShowFilters(true)} aria-haspopup="dialog">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
                Filter &amp; sort
                {activeFilterCount(filters) > 0 && <span className="ps-fcount" aria-label={`${activeFilterCount(filters)} active`}>{activeFilterCount(filters)}</span>}
              </button>
              <button
                onClick={() => canUse(plan, "portfolio_compare") ? (compareMode ? exitCompareMode() : setCompareMode(true)) : alert("Property comparison is available on Plot Scout Pro.")}
                className={`text-xs rounded-2xl px-4 min-h-[48px] border font-semibold whitespace-nowrap shrink-0 ${
                  compareMode ? "bg-field-accent border-field-accent" : "text-field-accent border-field-line hover:border-field-lineStrong"
                }`}
              >
                {compareMode ? "Cancel" : canUse(plan, "portfolio_compare") ? "Compare" : "Compare · Pro"}
              </button>
            </div>
            {(filters.decision !== "ALL" || filters.price) && (
              <div className="ps-fchips">
                {filters.decision !== "ALL" && <button type="button" onClick={() => setFilters({ ...filters, decision: "ALL" })} aria-label="Clear decision filter">{STATUS_FILTERS.find((f) => f.id === filters.decision)?.label} <span aria-hidden="true">×</span></button>}
                {filters.price && <button type="button" onClick={() => setFilters({ ...filters, price: null })} aria-label="Clear price filter">{fmtMoney(filters.price[0])} – {fmtMoney(filters.price[1])} <span aria-hidden="true">×</span></button>}
              </div>
            )}

            {compareMode && (
              <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-field-line ps-fade">
                <p className="text-field-muted text-xs">{selectedIds.length ? `${selectedIds.length} selected` : "Select 2–5 properties to compare"}</p>
                <button
                  onClick={openComparison}
                  disabled={selectedIds.length < 2 || comparisonLoading}
                  className="text-xs rounded-xl px-4 py-2.5 bg-field-accent font-semibold disabled:opacity-40"
                >
                  {comparisonLoading ? "Loading…" : `Compare selected (${selectedIds.length})`}
                </button>
              </div>
            )}
          </div>

            {/* Result count — filter cause → effect, stated plainly */}
            <p className="text-field-muted text-xs mb-3 px-1" key={`count-${filterKey}`} aria-live="polite">
              <span className="ps-fade inline-block" key={`${filterKey}-${sorted.length}`}>
                Showing <strong className="text-field-text font-semibold tabular-nums">{sorted.length}</strong> of <span className="tabular-nums">{properties.length}</span> {properties.length === 1 ? "plot" : "plots"}
              </span>
            </p>

            {sorted.length > 0 && (
              <div className="grid gap-4 grid-cols-[minmax(0,1fr)]" key={`list-${filterKey}`}>
                {sorted.map(({ property: p, score, tone }, i) => {
                  const isSelected = selectedIds.includes(p.id);
                  const isActive = selectedId === p.id && !compareMode;
                  const decision = beforeTokenDecision(p);
                  const completion = visitCompletion(p);
                  const e = economics(p.price);
                  const price = fmtMoney(e.effectivePrice);
                  const perGuntha = fmtMoney(e.perGuntha);
                  const area = e.areaGuntha ? `${Number(e.areaGuntha.toFixed(2)).toLocaleString("en-IN")} guntha`
                    : e.areaSqft ? `${Math.round(e.areaSqft).toLocaleString("en-IN")} sq ft`
                    : e.areaAcre ? `${Number(e.areaAcre.toFixed(2))} acre` : null;
                  const order = compareMode && isSelected ? selectedIds.indexOf(p.id) + 1 : undefined;
                  return (
                    <div
                      key={p.id}
                      ref={(el) => { if (el) cardRefs.current.set(p.id, el); else cardRefs.current.delete(p.id); }}
                      className="ps-property-row group relative ps-stagger scroll-mt-24 min-w-0"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <button
                        onClick={() => (compareMode ? toggleSelected(p.id) : onOpen(p.id))}
                        aria-pressed={compareMode ? isSelected : undefined}
                        className={`w-full text-left border border-field-line rounded-2xl p-5 md:p-6 transition-colors ps-property-btn ${
                          isActive ? "ps-card-active" : compareMode && isSelected ? "border-field-accent" : "border-field-line group-hover:border-field-lineStrong"
                        } ${tone === "bad" && !compareMode && !isActive ? "ps-attn-bad" : ""}`}
                      >
                        <div className="flex items-start gap-3.5">
                          {compareMode ? (
                            <span className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0 ${
                              isSelected ? "bg-field-accent border-field-accent" : "border-field-line text-field-muted"
                            }`} aria-hidden="true">
                              {order ?? ""}
                            </span>
                          ) : (
                            <ScoreRing value={score.total} tone={tone} size={46} />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`font-display text-field-text text-[19px] leading-tight truncate ${compareMode ? "" : "pr-24"}`}>{p.name}</p>
                              {!compareMode && <span className="hidden md:inline-flex text-field-muted shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronIcon /></span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <DecisionTag id={decision.id} label={decision.shortLabel} />
                              <span className="text-field-muted text-[11px]">{relativeTime(p.createdAt)}</span>
                            </div>

                            {/* Economics first — the card's red square */}
                            {(price || area || perGuntha || p.price.mainRoadDistanceM != null) && (
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-3.5 pt-3.5 border-t border-field-line">
                                {price && <div><dt className="text-[9px] uppercase tracking-[.1em] text-field-muted font-semibold">Price</dt><dd className="text-field-text text-[17px] font-bold tabular-nums mt-0.5">{price}</dd></div>}
                                {area && <div><dt className="text-[9px] uppercase tracking-[.1em] text-field-muted font-semibold">Area</dt><dd className="text-field-text text-[17px] font-bold tabular-nums mt-0.5">{area}</dd></div>}
                                {perGuntha && <div><dt className="text-[9px] uppercase tracking-[.1em] text-field-muted font-semibold">₹ / guntha</dt><dd className="text-field-text text-sm font-semibold tabular-nums mt-0.5">{perGuntha}</dd></div>}
                                {p.price.mainRoadDistanceM != null && <div><dt className="text-[9px] uppercase tracking-[.1em] text-field-muted font-semibold">Main road</dt><dd className="text-field-text text-sm font-semibold tabular-nums mt-0.5">{formatDistance(p.price.mainRoadDistanceM)}</dd></div>}
                              </dl>
                            )}

                            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mt-3 text-[11px] text-field-muted">
                              {p.location && <span className="inline-flex items-center gap-1"><PinIcon />{p.location.lat.toFixed(3)}, {p.location.lng.toFixed(3)}</span>}
                              {p.photos.length > 0 && <span className="inline-flex items-center gap-1"><CameraIcon />{p.photos.length}</span>}
                              {score.criticalFlags.length > 0 && <span className="inline-flex items-center gap-1 text-field-bad font-medium"><FlagIcon />{score.criticalFlags.length} flag{score.criticalFlags.length === 1 ? "" : "s"}</span>}
                              <span className="inline-flex items-center gap-1.5 ml-auto">
                                <span className="w-16 h-1 bg-field-raised rounded-full overflow-hidden inline-block"><span className="block h-full bg-field-accent rounded-full" style={{ width: `${completion}%` }} /></span>
                                <span className="tabular-nums">{completion}%</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>

                      {!compareMode && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                          {p.location && (
                            <a
                              href={googleMapsPointUrl(p.location.lat, p.location.lng)}
                              target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                              aria-label="Open in Google Maps"
                              className="w-11 h-11 grid place-items-center rounded-xl ps-surface-float border border-field-line text-field-muted hover:text-field-accent shadow-sm"
                            >
                              <PinIcon />
                            </a>
                          )}
                          <button
                            type="button"
                            aria-label={`Delete ${p.name}`}
                            onClick={async (e) => { e.stopPropagation(); if (confirm(`Delete ${p.name}? Its saved photos will also be removed. Create a Full Backup first if you may need it later.`)) await onDelete(p.id); }}
                            className="w-11 h-11 grid place-items-center rounded-xl ps-surface-float border border-field-line text-field-bad hover:border-field-bad/50 shadow-sm"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showInsights && <InsightsSheet properties={properties} onClose={() => setShowInsights(false)} onOpen={onOpen} />}

      {showFilters && (
        <FilterSheet
          initial={filters}
          prices={prices}
          unpriced={properties.length - prices.length}
          countFor={(f) => scored.filter((it) => matches(it, f)).length}
          onApply={(f) => { setFilters(f); setShowFilters(false); }}
          onClose={() => setShowFilters(false)}
        />
      )}

      {showComparison && comparisonProperties.length >= 2 && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center text-field-muted text-sm">Preparing comparison…</div>}>
          <PropertyComparison properties={comparisonProperties} onClose={() => setShowComparison(false)} onOpen={(id) => { setShowComparison(false); onOpen(id); }} />
        </Suspense>
      )}

      {/* Mobile bottom sheet — marker → camera → sheet (peek/half/full) → dossier */}
      {!compareMode && (
        <PropertySheet
          item={selectedId ? scored.find((s) => s.property.id === selectedId) ?? null : null}
          onClose={() => setSelectedId(null)}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

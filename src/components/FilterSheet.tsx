import { useEffect, useMemo, useRef, useState } from "react";
import { BeforeTokenDecision } from "../utils/decision";
import { fmtMoney } from "../utils/format";

export type SortKey = "newest" | "oldest" | "score_desc" | "score_asc" | "price_desc" | "price_asc" | "area_desc" | "area_asc";
export interface Filters {
  decision: "ALL" | BeforeTokenDecision;
  /** inclusive ₹ range on effective price; null = no price filter */
  price: [number, number] | null;
  sortBy: SortKey;
}
export const DEFAULT_FILTERS: Filters = { decision: "ALL", price: null, sortBy: "newest" };
export function activeFilterCount(f: Filters) {
  return (f.decision !== "ALL" ? 1 : 0) + (f.price ? 1 : 0) + (f.sortBy !== "newest" ? 1 : 0);
}

const DECISIONS: { id: Filters["decision"]; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "PROCEED_TO_VERIFICATION", label: "Proceed" },
  { id: "HOLD_MORE_INFO", label: "Hold" },
  { id: "HIGH_CONCERN", label: "Concern" },
  { id: "INSUFFICIENT_DATA", label: "No data" }
];
const SORTS: { key: "newest" | "score" | "price" | "area"; label: string }[] = [
  { key: "newest", label: "Date" },
  { key: "score", label: "Score" },
  { key: "price", label: "Price" },
  { key: "area", label: "Area" }
];
function splitSort(s: SortKey): { key: "newest" | "score" | "price" | "area"; dir: "desc" | "asc" } {
  if (s === "newest") return { key: "newest", dir: "desc" };
  if (s === "oldest") return { key: "newest", dir: "asc" };
  const [k, d] = s.split("_") as ["score" | "price" | "area", "desc" | "asc"];
  return { key: k, dir: d };
}
function joinSort(key: string, dir: "desc" | "asc"): SortKey {
  if (key === "newest") return dir === "desc" ? "newest" : "oldest";
  return `${key}_${dir}` as SortKey;
}

const BINS = 24;

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="ps-seg ps-fseg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Price distribution of the plots actually saved — bars, then a two-handle range over them. */
function PriceHistogram({ prices, value, onChange }: { prices: number[]; value: [number, number] | null; onChange: (v: [number, number] | null) => void }) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min;
  const bins = useMemo(() => {
    const b = new Array(BINS).fill(0) as number[];
    for (const p of prices) b[Math.min(BINS - 1, Math.floor(((p - min) / span) * BINS))]++;
    return b;
  }, [prices, min, span]);
  const peak = Math.max(...bins);
  const lo = value ? value[0] : min;
  const hi = value ? value[1] : max;
  const toPct = (v: number) => ((v - min) / span) * 100;
  const fromPct = (p: number) => min + (p / 100) * span;
  const set = (a: number, b: number) => {
    const nlo = Math.min(a, b), nhi = Math.max(a, b);
    onChange(nlo <= min && nhi >= max ? null : [Math.round(nlo), Math.round(nhi)]);
  };
  const inCount = prices.filter((p) => p >= lo && p <= hi).length;
  return (
    <div className="ps-hist">
      <div className="ps-hist-readout">
        <div><small>From</small><strong className="font-display tabular-nums">{fmtMoney(lo)}</strong></div>
        <div className="is-end"><small>To</small><strong className="font-display tabular-nums">{fmtMoney(hi)}</strong></div>
      </div>
      <div className="ps-hist-bars" aria-hidden="true">
        {bins.map((n, i) => {
          const binLo = min + (i / BINS) * span, binHi = min + ((i + 1) / BINS) * span;
          const on = binHi >= lo && binLo <= hi;
          return <i key={i} className={on ? "is-on" : ""} style={{ height: n ? `${Math.max(10, (n / peak) * 100)}%` : "2px", animationDelay: `${i * 12}ms` }} />;
        })}
      </div>
      <div className="ps-hist-range">
        <div className="ps-hist-track"><span style={{ left: `${toPct(lo)}%`, right: `${100 - toPct(hi)}%` }} /></div>
        <input type="range" min={0} max={100} step={0.5} value={toPct(lo)} aria-label="Minimum price" aria-valuetext={fmtMoney(lo) ?? ""}
          onChange={(e) => set(Math.min(fromPct(+e.target.value), hi), hi)} />
        <input type="range" min={0} max={100} step={0.5} value={toPct(hi)} aria-label="Maximum price" aria-valuetext={fmtMoney(hi) ?? ""}
          onChange={(e) => set(lo, Math.max(fromPct(+e.target.value), lo))} />
      </div>
      <p className="ps-hist-note">{inCount} of {prices.length} priced {prices.length === 1 ? "plot" : "plots"} in range</p>
    </div>
  );
}

export default function FilterSheet({
  initial, prices, unpriced, countFor, onApply, onClose
}: {
  initial: Filters;
  prices: number[];
  unpriced: number;
  countFor: (f: Filters) => number;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(initial);
  const ref = useRef<HTMLDivElement>(null);
  const sort = splitSort(draft.sortBy);
  const count = countFor(draft);
  const canPrice = prices.length >= 2 && Math.max(...prices) > Math.min(...prices);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    ref.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", key); };
  }, [onClose]);

  return (
    <div className="ps-cmp-scrim ps-fade ps-fscrim" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Filters" className="ps-fsheet ps-sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="ps-dsheet-grab" aria-hidden="true" />
        <header className="ps-fhead">
          <h2 className="font-display">Filters</h2>
          <button type="button" className="ps-link-btn" onClick={() => setDraft(DEFAULT_FILTERS)} disabled={activeFilterCount(draft) === 0}>Reset</button>
        </header>

        <div className="ps-fbody">
          <section>
            <p className="ps-label">Decision</p>
            <Segmented label="Decision" value={draft.decision} options={DECISIONS} onChange={(decision) => setDraft({ ...draft, decision })} />
          </section>

          <section>
            <p className="ps-label">Price</p>
            {canPrice ? (
              <>
                <PriceHistogram prices={prices} value={draft.price} onChange={(price) => setDraft({ ...draft, price })} />
                {unpriced > 0 && draft.price && <p className="ps-hist-note">{unpriced} {unpriced === 1 ? "plot has" : "plots have"} no price and will be hidden.</p>}
              </>
            ) : (
              <p className="ps-fempty">{prices.length === 0 ? "Add prices to your plots to filter by price." : "Prices are identical so far — add more to see a spread."}</p>
            )}
          </section>

          <section>
            <p className="ps-label">Sort by</p>
            <div className="ps-fsort">
              <Segmented label="Sort key" value={sort.key} options={SORTS.map((s) => ({ id: s.key, label: s.label }))} onChange={(k) => setDraft({ ...draft, sortBy: joinSort(k, sort.dir) })} />
              <Segmented label="Direction" value={sort.dir} options={[{ id: "desc", label: sort.key === "newest" ? "Newest" : "High → low" }, { id: "asc", label: sort.key === "newest" ? "Oldest" : "Low → high" }]} onChange={(d) => setDraft({ ...draft, sortBy: joinSort(sort.key, d) })} />
            </div>
          </section>
        </div>

        <footer className="ps-ffoot">
          <button type="button" className="ps-btn-primary" onClick={() => onApply(draft)} disabled={count === 0}>
            {count === 0 ? "No plots match" : `Show ${count} ${count === 1 ? "plot" : "plots"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

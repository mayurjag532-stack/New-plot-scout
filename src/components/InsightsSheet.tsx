import { useEffect, useMemo } from "react";
import { PropertyRecord } from "../types";
import { economics } from "../utils/economics";
import { computeScore } from "../utils/scoring";
import { fmtMoney, fmtRupees } from "../utils/format";

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Portfolio insight — Fundrise logic: one hero number, a few quiet supporting figures,
 * one calm chart. Every figure is derived from saved records; nothing is estimated.
 */
export default function InsightsSheet({ properties, onClose, onOpen }: { properties: PropertyRecord[]; onClose: () => void; onOpen: (id: string) => void }) {
  const data = useMemo(() => {
    const rows = properties.map((p) => ({ p, e: economics(p.price), s: computeScore(p) }));
    const priced = rows.filter((r) => r.e.effectivePrice != null);
    const total = priced.reduce((a, r) => a + (r.e.effectivePrice as number), 0);
    const perSqft = rows.filter((r) => r.e.perSqft != null).map((r) => ({ id: r.p.id, name: r.p.name || "Untitled", v: r.e.perSqft as number })).sort((a, b) => b.v - a.v);
    const medGuntha = median(rows.map((r) => r.e.perGuntha).filter((v): v is number => v != null));
    const avgScore = rows.length ? Math.round(rows.reduce((a, r) => a + r.s.total, 0) / rows.length) : null;
    const photos = rows.reduce((a, r) => a + r.p.photos.length, 0);
    const withPhotos = rows.filter((r) => r.p.photos.length > 0).length;
    const flagged = rows.filter((r) => r.s.criticalFlags.length > 0).length;
    return { n: rows.length, priced: priced.length, total, perSqft, medSqft: median(perSqft.map((x) => x.v)), medGuntha, avgScore, photos, withPhotos, flagged };
  }, [properties]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", key); };
  }, [onClose]);

  const max = data.perSqft.length ? data.perSqft[0].v : 0;
  const quiet: { label: string; value: string; sub?: string }[] = [
    { label: "Median ₹ / guntha", value: fmtMoney(data.medGuntha) ?? "—" },
    { label: "Average score", value: data.avgScore != null ? String(data.avgScore) : "—", sub: "of 100" },
    { label: "Evidence", value: `${data.withPhotos}/${data.n}`, sub: `${data.photos} photo${data.photos === 1 ? "" : "s"}` },
    { label: "Need verification", value: String(data.flagged), sub: data.flagged === 1 ? "plot flagged" : "plots flagged" }
  ];

  return (
    <div className="ps-cmp-scrim ps-fade ps-fscrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Portfolio insights" className="ps-fsheet ps-insights ps-sheet-up" onClick={(e) => e.stopPropagation()}>
        <div className="ps-dsheet-grab" aria-hidden="true" />
        <header className="ps-fhead">
          <div><p className="ps-kicker">Insights</p><h2 className="font-display">Your portfolio</h2></div>
          <button type="button" className="ps-link-btn" onClick={onClose}>Done</button>
        </header>
        <div className="ps-fbody">
          <div className="ps-metric">
            <p className="ps-metric-label">{data.priced ? "Portfolio value" : "Plots tracked"}</p>
            <p className="ps-metric-value font-display tabular-nums">{data.priced ? fmtMoney(data.total) : data.n}</p>
            <p className="ps-metric-context">{data.priced ? `Effective prices across ${data.priced} of ${data.n} ${data.n === 1 ? "plot" : "plots"}` : "Add prices during visits to see portfolio value"}</p>
          </div>

          <dl className="ps-ins-quiet">
            {quiet.map((q) => <div key={q.label}><dt>{q.label}</dt><dd className="font-display tabular-nums">{q.value}</dd>{q.sub && <small>{q.sub}</small>}</div>)}
          </dl>

          <section aria-label="Price per square foot by plot">
            <p className="ps-label">₹ per sq ft, by plot</p>
            {data.perSqft.length >= 2 ? (
              <ol className="ps-ins-chart">
                {data.perSqft.map((r, i) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => { onClose(); onOpen(r.id); }} aria-label={`${r.name}: ${fmtRupees(r.v)} per square foot. Open dossier`}>
                      <span className="ps-ins-name">{r.name}</span>
                      <span className="ps-ins-val tabular-nums">{fmtRupees(r.v)}</span>
                      <span className="ps-ins-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, (r.v / max) * 100)}%`, animationDelay: `${i * 40}ms` }} />
                        {data.medSqft != null && <b style={{ left: `${(data.medSqft / max) * 100}%` }} />}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ps-fempty">Price and area for at least two plots are needed to compare ₹ per sq ft.</p>
            )}
            {data.medSqft != null && data.perSqft.length >= 2 && <p className="ps-hist-note">Marker shows the median, {fmtRupees(data.medSqft)} per sq ft.</p>}
          </section>
          <p className="ps-hist-note">Figures come only from details you recorded. They are not valuations or market estimates.</p>
        </div>
      </div>
    </div>
  );
}

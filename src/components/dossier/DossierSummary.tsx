import { useLayoutEffect, useRef } from "react";
import { PropertyRecord } from "../../types";
import { economics } from "../../utils/economics";
import { formatDistance } from "../../utils/geo";
import { computeScore } from "../../utils/scoring";
import { beforeTokenDecision } from "../../utils/decision";
import { areaLabel, fmtMoney, identityLine } from "../../utils/format";
import { DecisionTag, decisionTone } from "../ui/StatusTag";
import { ScoreRing } from "../ui/ScoreRing";

export type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saved") {
    return (
      <span className="ps-save" role="status">
        <span className="ps-save-check w-4 h-4 rounded-full bg-field-good/15 grid place-items-center text-field-good" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <span className="ps-save-text">Saved to this device</span>
      </span>
    );
  }
  return (
    <span className={`ps-save ${state === "error" ? "is-error" : ""}`} role="status">
      <span className={`w-1.5 h-1.5 rounded-full ml-1.5 ${state === "saving" ? "bg-field-accent animate-pulse" : state === "error" ? "bg-field-bad" : "bg-field-muted"}`} aria-hidden="true" />
      <span className="ps-save-text">{state === "saving" ? "Saving…" : state === "error" ? "Save failed — will retry" : "Stored locally"}</span>
    </span>
  );
}

/**
 * Property identity + the one hero metric (Land.id dossier × The Modern House).
 * Serif name, one large figure, then quiet supporting facts. Only data that
 * exists is shown; the hero metric falls back price → area → score.
 */
export default function DossierSummary({
  property,
  saveState,
  onNameChange,
  onJump
}: {
  property: PropertyRecord;
  saveState: SaveState;
  onNameChange: (name: string) => void;
  onJump: (sectionId: string) => void;
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [property.name]);
  const score = computeScore(property);
  const decision = beforeTokenDecision(property);
  const tone = decisionTone(decision.id);
  const e = economics(property.price);
  const price = fmtMoney(e.effectivePrice);
  const area = areaLabel(e);
  const perGuntha = fmtMoney(e.perGuntha);
  const road = property.price.mainRoadDistanceM != null ? formatDistance(property.price.mainRoadDistanceM) : null;
  const where = identityLine(property);

  const heroKind = price ? "price" : area ? "area" : "score";
  const hero =
    heroKind === "price" ? { label: "Effective price", value: price as string, suffix: "" } :
    heroKind === "area" ? { label: "Plot area", value: area as string, suffix: "" } :
    { label: "Plot score", value: String(Math.round(score.total)), suffix: "/ 100" };

  // Under the figure: one honest line of context, from the user's own numbers.
  const context =
    e.discountPct != null && e.discountAmount != null && e.discountPct > 0
      ? `${fmtMoney(e.discountAmount)} below the asking price · ${e.discountPct.toFixed(0)}%`
      : e.discountPct != null && e.discountPct < 0
      ? `${Math.abs(e.discountPct).toFixed(0)}% above the asking price`
      : e.totalAcquisition && e.totalAcquisition !== e.effectivePrice
      ? `${fmtMoney(e.totalAcquisition)} including additional costs`
      : null;

  const quiet: { label: string; value: string }[] = [];
  if (heroKind !== "area" && area) quiet.push({ label: "Area", value: area });
  if (perGuntha) quiet.push({ label: "₹ / guntha", value: perGuntha });
  if (road) quiet.push({ label: "Main road", value: road });
  if (heroKind !== "price" && price) quiet.push({ label: "Price", value: price });

  const flags = score.criticalFlags.length;

  return (
    <header className="ps-dsum ps-rise">
      <p className="ps-kicker ps-dsum-kicker">{where || "Field dossier"}</p>
      <label className="sr-only" htmlFor="ps-name">Property name</label>
      <textarea
        id="ps-name"
        ref={titleRef}
        rows={1}
        value={property.name}
        onChange={(e) => onNameChange(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
        className="ps-dsum-title ps-title-input font-display"
        placeholder="Name this property"
        autoComplete="off"
        spellCheck={false}
      />

      <div className="ps-dsum-verdict">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <DecisionTag id={decision.id} label={decision.shortLabel} />
            <span className="ps-dsum-conf">Confidence {score.confidence.toLowerCase()}</span>
          </div>
          <p className="ps-dsum-why">{decision.why}</p>
        </div>
        <ScoreRing key={property.id} value={score.total} tone={tone} size={56} strokeWidth={5} />
      </div>

      <div className="ps-metric">
        <p className="ps-metric-label">{hero.label}</p>
        <p className="ps-metric-value font-display tabular-nums">
          {hero.value}
          {hero.suffix && <span className="ps-metric-suffix">{hero.suffix}</span>}
        </p>
        {context && <p className="ps-metric-context">{context}</p>}
      </div>

      {quiet.length > 0 && (
        <dl className="ps-quiet" style={{ gridTemplateColumns: `repeat(${Math.min(quiet.length, 3)}, minmax(0,1fr))` }}>
          {quiet.slice(0, 3).map((q) => (
            <div key={q.label}><dt>{q.label}</dt><dd className="font-display tabular-nums">{q.value}</dd></div>
          ))}
        </dl>
      )}

      <dl className="ps-facts">
        {property.location && (
          <div className="ps-fact">
            <dt>Position</dt>
            <dd className="font-mono">{property.location.lat.toFixed(5)}, {property.location.lng.toFixed(5)}</dd>
          </div>
        )}
        {property.location?.accuracy != null && (
          <div className="ps-fact"><dt>GPS</dt><dd>±{Math.round(property.location.accuracy)} m</dd></div>
        )}
        <div className="ps-fact">
          <dt>Critical flags</dt>
          <dd className={flags ? "text-field-bad" : ""}>
            {flags ? <button type="button" className="ps-link-inline" onClick={() => onJump("decision")}>{flags} to resolve</button> : "None"}
          </dd>
        </div>
      </dl>

      <div className="ps-dossier-save"><SaveIndicator state={saveState} /></div>
    </header>
  );
}

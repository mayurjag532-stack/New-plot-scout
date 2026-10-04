import { PropertyRecord, PropertyStatus } from "../types";
import { computeScore } from "../utils/scoring";
import { beforeTokenDecision } from "../utils/decision";
import { DecisionTag, SignalTag, decisionTone } from "./ui/StatusTag";
import { ScoreRing } from "./ui/ScoreRing";

const STATUS_LABEL: Record<PropertyStatus, string> = { STRONG: "Strong", INVESTIGATE: "Investigate", REJECT: "Reject", UNDECIDED: "Undecided" };
const labels: Record<string, string> = { location: "Location", access: "Access", price: "Price", infrastructure: "Infrastructure", siteCondition: "Site", evidence: "Evidence", legalReadiness: "Legal readiness", risk: "Risk" };
const maxes: Record<string, number> = { location: 15, access: 15, price: 15, infrastructure: 15, siteCondition: 15, evidence: 10, legalReadiness: 10, risk: 5 };

function WarnIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a1.8 1.8 0 0 0 1.5 2.7h17.4a1.8 1.8 0 0 0 1.5-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>; }
function VerifyIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" strokeDasharray="2.5 2.5" /></svg>; }

export default function FinalStatusPanel({ property, onStatusChange, onFollowUpChange }: { property: PropertyRecord; onStatusChange: (s: PropertyStatus) => void; onFollowUpChange: (v: string) => void; }) {
  const score = computeScore(property);
  const decision = beforeTokenDecision(property);
  const tone = decisionTone(decision.id);

  return (
    <div className="ps-decide">
      <p className="ps-label">Where this stands</p>

      {/* WHAT TO DO NEXT — leads, because it's the answer the person opened this panel for */}
      <div className="mt-3 grid md:grid-cols-[auto,1fr] gap-4 md:gap-5 items-center">
        <ScoreRing key={property.id} value={score.total} tone={tone} size={72} strokeWidth={6} animate />
        <div key={property.id} className="ps-reveal">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display text-field-text text-[26px] md:text-[30px] leading-[1.1]">{decision.label}</p>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <DecisionTag id={decision.id} label={decision.shortLabel} />
            <span className="text-field-muted text-[11px]">Confidence: {score.confidence}</span>
          </div>
          <p className="text-field-muted text-xs mt-2 leading-relaxed">{decision.why}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mt-4">
        {/* WHAT NEEDS ATTENTION */}
        {score.criticalFlags.length > 0 && (
          <div className="ps-callout is-bad">
            <p className="text-field-bad text-[11px] font-semibold uppercase tracking-[.12em]">Critical verification flags</p>
            <div className="mt-2 space-y-2">
              {score.criticalFlags.map((x, i) => <div key={i} className="ps-reveal-stagger flex items-start gap-2 text-field-text text-xs leading-snug" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}><WarnIcon />{x}</div>)}
            </div>
          </div>
        )}

        {/* WHAT REMAINS UNVERIFIED — the checklist to actually act on before paying a token */}
        {decision.verifyNext.length > 0 && (
          <div className={`ps-verify ${score.criticalFlags.length === 0 ? "md:col-span-2" : ""}`}>
            <p className="text-field-text text-xs font-semibold">Verify before paying token ({decision.verifyNext.length})</p>
            <div className="mt-2 space-y-2">
              {decision.verifyNext.slice(0, 6).map((x, i) => <div key={i} className="ps-reveal-stagger flex items-start gap-2 text-field-muted text-xs leading-snug" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}><VerifyIcon />{x}</div>)}
            </div>
          </div>
        )}
      </div>

      {/* WHAT PLOT SCOUT KNOWS — the score, positioned as supporting evidence rather than the headline */}
      <details className="mt-4 group">
        <summary className="ps-decide-sum">
          <span className="text-field-muted text-xs">Overall Site Signal — supporting evidence, not the answer</span>
          <span className="flex items-center gap-2 shrink-0">
            <SignalTag status={score.status} label={STATUS_LABEL[score.status]} />
            <span className="text-field-text text-sm font-bold tabular-nums">{score.total}<span className="text-field-muted text-xs font-normal">/100</span></span>
          </span>
        </summary>
        <div className="mt-3 space-y-2 px-1">
          {Object.entries(score.breakdown).map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-xs"><span className="text-field-muted">{labels[k]}</span><span className="text-field-text tabular-nums">{v}/{maxes[k]}</span></div>
              <div className="h-1 mt-1 bg-field-raised rounded-full overflow-hidden"><div className="h-full bg-field-accent rounded-full" style={{ width: `${(v / maxes[k]) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        {score.concerns.length > 0 && (
          <div className="mt-3 px-1">
            <p className="text-field-muted text-[11px] uppercase tracking-[.12em]">Needs attention</p>
            {score.concerns.map((x, i) => <p key={i} className="text-field-muted text-xs mt-1">· {x}</p>)}
          </div>
        )}
      </details>

      <p className="text-field-muted text-[11px] mt-3">Score reflects recorded field evidence and data completeness. It is not a market valuation, title opinion or legal certification.</p>

      <div className="mt-6 pt-5 border-t border-field-line">
        <p className="ps-label mb-2">Your follow-up status</p>
        <div className="ps-seg ps-decide-seg" role="group" aria-label="Follow-up status">
          {(Object.keys(STATUS_LABEL) as PropertyStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              aria-pressed={property.finalStatus === s}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <textarea value={property.followUp} onChange={(e) => onFollowUpChange(e.target.value)} placeholder="Follow-up plan (call back, revisit, negotiate...)" rows={2} className="w-full mt-3 bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm" />
    </div>
  );
}

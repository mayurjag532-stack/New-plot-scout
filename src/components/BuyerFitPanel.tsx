import { PropertyRecord } from "../types";
import { BuyerProfile, computeBuyerFit } from "../personalization";

const FIT_TONE: Record<ReturnType<typeof computeBuyerFit>["label"], string> = {
  "EXCELLENT MATCH": "text-field-good", "GOOD MATCH": "text-field-good",
  "PARTIAL MATCH": "text-field-warn", "POOR MATCH": "text-field-bad", "NOT ENOUGH DATA": ""
};

export default function BuyerFitPanel({ property, profile }: { property: PropertyRecord; profile: BuyerProfile }) {
  if (!profile.enabled) return null;
  const fit = computeBuyerFit(property, profile);

  return (
    <div className="buyer-fit-card">
      <div className="buyer-fit-head">
        <div>
          <p className="ps-kicker">Personalised decision layer</p>
          <h3>Your Fit</h3>
          <p>Compared with {profile.name || "your saved land criteria"}. This does not change the objective property score.</p>
        </div>
        <div className="buyer-fit-score">
          {fit.score == null ? "—" : fit.score}
          <small>{fit.score == null ? "" : "/100"}</small>
        </div>
      </div>

      <div className="buyer-fit-meta">
        <span className={`font-semibold ${FIT_TONE[fit.label]}`}>{fit.label}</span>
        <span>Confidence {fit.confidence}</span>
        {fit.configured > 0 && <span>{fit.checked}/{fit.configured} criteria evaluated</span>}
      </div>

      {fit.score == null && fit.configured > 0 && (
        <p className="fit-evidence-note">
          Fit score will appear after enough of your saved criteria can be evaluated. Missing information is not scored as zero.
        </p>
      )}

      {fit.conflicts.length > 0 && (
        <div className="fit-group conflict">
          <b>Conflicts</b>
          {fit.conflicts.map(x => <p key={x}>• {x}</p>)}
        </div>
      )}

      {fit.verify.length > 0 && (
        <div className="fit-group verify">
          <b>Needs verification</b>
          {fit.verify.map(x => <p key={x}>• {x}</p>)}
        </div>
      )}

      {fit.matches.length > 0 && (
        <details className="fit-group">
          <summary>Matches · {fit.matches.length}</summary>
          {fit.matches.map(x => <p key={x}>• {x}</p>)}
        </details>
      )}

      <p className="fit-disclaimer">
        Buyer Fit scores only evaluable saved criteria. Missing data lowers confidence, not the score. Map distances are approximate straight-line signals and never prove legal access, boundary, title, zoning or highway-touch status.
      </p>
    </div>
  );
}

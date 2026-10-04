import { PropertyRecord } from "../types";
import { computeScore } from "./scoring";

export type BeforeTokenDecision = "PROCEED_TO_VERIFICATION"|"HOLD_MORE_INFO"|"HIGH_CONCERN"|"INSUFFICIENT_DATA";

export interface DecisionModel {
  id: BeforeTokenDecision;
  label: string;
  shortLabel: string;
  tone: "good"|"warn"|"bad"|"neutral";
  why: string;
  verifyNext: string[];
}

export function beforeTokenDecision(p:PropertyRecord):DecisionModel{
  const score=computeScore(p);
  const q=p.ownerAnswers;
  const verifyNext=Array.from(new Set([
    ...score.criticalFlags,
    ...score.concerns,
    !p.identity?.gatNo && !p.identity?.surveyNo ? "Record and independently verify the Gat / Survey number." : "",
    !q.q_712_papers ? "Check 7/12 and relevant property papers with the appropriate official/professional source." : "",
    !q.q_road_legal ? "Verify legal access / road status from documents; mapped road proximity does not prove a legal right of access." : "",
    !q.q_loan_dispute ? "Verify loan, mortgage, encumbrance and dispute status independently." : "",
    !q.q_na_or_agri ? "Verify land classification / NA or agricultural status." : "",
    !q.q_current_zone ? "Verify current zoning / permitted use from the authoritative source." : "",
    p.location?.accuracy != null && p.location.accuracy > 75 ? `Captured GPS accuracy was ±${Math.round(p.location.accuracy)} m; recapture/verify the site position if precision matters.` : "",
    p.parcelIntel?.mismatchAssessment === "VERIFY" ? `Field GPS and the saved parcel/map reference differ by about ${p.parcelIntel.mismatchMeters ?? "an unknown distance"} m. Verify the parcel identity and position from official records before commitment.` : "",
    (p.identity?.gatNo || p.identity?.surveyNo) && p.parcelIntel?.status !== "user_confirmed_location" ? "Gat/Survey identity is recorded, but parcel boundary/location has not been independently resolved in Plot Scout." : ""
  ].filter(Boolean)));

  if(score.confidence==="LOW") return {id:"INSUFFICIENT_DATA",label:"UNDECIDED / INSUFFICIENT DATA",shortLabel:"Insufficient data",tone:"neutral",why:"There is not enough recorded evidence for a reliable property decision yet.",verifyNext};
  if(score.criticalFlags.length>0) return {id:"HOLD_MORE_INFO",label:"HOLD / MORE INFORMATION NEEDED",shortLabel:"Hold / verify",tone:"warn",why:"Important unresolved verification items exist. Do not treat this field record as legal clearance.",verifyNext};
  if(score.status==="STRONG") return {id:"PROCEED_TO_VERIFICATION",label:"PROCEED TO VERIFICATION",shortLabel:"Proceed to verify",tone:"good",why:"The recorded field evidence is strong enough to justify the next stage of independent legal and document verification.",verifyNext};
  if(score.status==="REJECT") return {id:"HIGH_CONCERN",label:"HIGH CONCERN",shortLabel:"High concern",tone:"bad",why:"The recorded field evidence is currently weak enough to warrant caution before spending further money or paying a token.",verifyNext};
  return {id:"HOLD_MORE_INFO",label:"HOLD / MORE INFORMATION NEEDED",shortLabel:"Hold / verify",tone:"warn",why:"The property needs more evidence or clarification before the next commitment.",verifyNext};
}

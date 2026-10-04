import { PropertyRecord, Score, CHECKLIST_ITEMS } from "../types";
import { economics } from "./economics";
import { isLegacyOwnerAnswer, isStructuredOwnerAnswer } from "./structuredOwnerAnswers";

const answered=(p:PropertyRecord,id:string)=>p.checklist[id] !== null && p.checklist[id] !== undefined;
const yes=(p:PropertyRecord,id:string)=>p.checklist[id] === true;

export function computeScore(p: PropertyRecord): Score {
  const positives:string[]=[], concerns:string[]=[], criticalFlags:string[]=[];
  const intel=p.mapIntel;

  // Location 15
  let location=0;
  if(intel.status==="ok"||intel.status==="partial"){
    if(intel.nearestRoad){ location+=5; positives.push(`Mapped road ${Math.round(intel.nearestRoad.distanceMeters)}m away`); }
    if(intel.nearestMajorRoad){ const d=intel.nearestMajorRoad.distanceMeters; const pts=d<=500?6:d<=1000?4:d<=2000?2:1; location+=pts; positives.push(`Major road ${Math.round(d)}m away`); }
    if(intel.nearestHighway){ location+=4; }
  } else concerns.push("Map intelligence is incomplete");
  location=Math.min(15,location);

  // Access 15
  let access=0;
  if(yes(p,"approach_car_friendly")) access+=5; else if(answered(p,"approach_car_friendly")){ concerns.push("Approach road is not confirmed car-friendly"); }
  if(yes(p,"main_road_practical")) access+=3;
  const rw=p.price.roadWidthFt;
  if(rw){ access+=rw>=30?5:rw>=20?4:rw>=12?2:1; if(rw<12) concerns.push(`Road width is only ${rw} ft`); }
  if(p.price.mainRoadDistanceM!=null){ const d=p.price.mainRoadDistanceM; access+=d<=500?2:d<=1000?1:0; }
  access=Math.min(15,access);

  // Price/economics 15: score completeness/negotiation quality, never pretend market valuation.
  const eco=economics(p.price); let price=0;
  if(eco.effectivePrice) price+=4;
  if(eco.areaSqft) price+=4;
  if(eco.perSqft) price+=2;
  if(p.price.askingPrice && (p.price.negotiatedPrice||p.price.quotedPrice)) price+=2;
  if(eco.discountPct!=null && eco.discountPct>0){ price+=Math.min(3,eco.discountPct>=10?3:eco.discountPct>=5?2:1); positives.push(`Price is ${eco.discountPct.toFixed(1)}% below asking`); }
  if(eco.areaMismatch){ price=Math.max(0,price-3); concerns.push("Entered area units conflict"); }
  price=Math.min(15,price);

  // Infrastructure 15
  let infrastructure=0;
  if(yes(p,"electricity_accessible")) infrastructure+=3;
  if(yes(p,"water_available")) infrastructure+=3;
  if(yes(p,"residential_catchment")) infrastructure+=3;
  if(yes(p,"area_active")) infrastructure+=2;
  if(intel.status==="ok"||intel.status==="partial") infrastructure+=Math.min(4, Math.ceil((intel.education.length+intel.access.length+intel.residential.length)/3));
  infrastructure=Math.min(15,infrastructure);

  // Site condition 15
  const siteIds=["plot_shape_ok","land_flat","no_waterlogging","no_nala_issue","parking_practical","area_safe_evening","commercially_practical"];
  const siteAnswered=siteIds.filter(id=>answered(p,id)).length, siteYes=siteIds.filter(id=>yes(p,id)).length;
  let siteCondition=siteAnswered?Math.round((siteYes/siteIds.length)*15):0;
  if(p.checklist["no_waterlogging"]===false){ concerns.push("Waterlogging concern observed"); }
  if(p.checklist["no_nala_issue"]===false){ concerns.push("Nala/problem-area concern observed"); }

  // Evidence 10
  let evidence=0;
  if(p.location) evidence+=2;
  if(p.photos.length>=6) evidence+=3; else if(p.photos.length>=2) evidence+=2; else if(p.photos.length) evidence+=1;
  const answeredCount=CHECKLIST_ITEMS.filter(x=>answered(p,x.id)).length;
  evidence+=Math.min(3,Math.round((answeredCount/CHECKLIST_ITEMS.length)*3));
  if(p.notes.site||p.notes.owner||p.notes.general) evidence+=1;
  if(p.identity?.gatNo||p.identity?.surveyNo) evidence+=1;
  evidence=Math.min(10,evidence);

  // Legal readiness 10. Only evidence/readiness, never legal validity.
  let legalReadiness=0;
  const q=p.ownerAnswers;
  if((q.q_gat_survey_no||"").trim() || p.identity?.gatNo || p.identity?.surveyNo) legalReadiness+=2; else concerns.push("Gat/Survey number not recorded");
  if(isStructuredOwnerAnswer("q_712_papers", q.q_712_papers)) legalReadiness+=2;
  else if(isLegacyOwnerAnswer("q_712_papers", q.q_712_papers)) concerns.push("Legacy 7/12 / papers answer needs re-verification");
  else concerns.push("7/12 / property papers not recorded as checked");
  if((q.q_na_or_agri||"").trim()) legalReadiness+=1;
  if((q.q_current_zone||"").trim()) legalReadiness+=1;
  if(isStructuredOwnerAnswer("q_road_legal", q.q_road_legal)) legalReadiness+=2;
  else if(isLegacyOwnerAnswer("q_road_legal", q.q_road_legal)) concerns.push("Legacy legal road/access answer needs re-verification");
  else concerns.push("Legal road/access status not recorded");
  if(isStructuredOwnerAnswer("q_loan_dispute", q.q_loan_dispute)) legalReadiness+=2;
  else if(isLegacyOwnerAnswer("q_loan_dispute", q.q_loan_dispute)) concerns.push("Legacy loan/dispute answer needs re-verification");
  if(p.identity?.provenance==="VERIFIED") legalReadiness=Math.min(10,legalReadiness+1);

  // Risk 5: starts positive, explicit negative observations reduce it.
  let risk=5;
  if(p.checklist["no_waterlogging"]===false) risk-=1;
  if(p.checklist["no_nala_issue"]===false) risk-=2;
  if(p.checklist["area_safe_evening"]===false) risk-=1;
  if(p.checklist["approach_car_friendly"]===false) risk-=1;
  risk=Math.max(0,risk);

  // Critical flags are driven only by constrained answers, never sentiment/regex over free Hinglish text.
  // Legacy free-text values remain preserved for old records but are treated as unclassified, not as legal conclusions.
  const roadStatus = q.q_road_legal || "";
  const disputeStatus = q.q_loan_dispute || "";
  const papersStatus = q.q_712_papers || "";
  if(isLegacyOwnerAnswer("q_road_legal", roadStatus)) criticalFlags.push("Previous legal road/access answer needs re-verification — no conclusion carried forward");
  else if(roadStatus === "Not shown in papers") criticalFlags.push("Legal road/access reported as not shown in papers — independently verify before proceeding");
  else if(roadStatus === "Unclear") criticalFlags.push("Legal road/access status is unclear — independent verification required");

  if(isLegacyOwnerAnswer("q_loan_dispute", disputeStatus)) criticalFlags.push("Previous loan/dispute answer needs re-verification — no conclusion carried forward");
  else if(disputeStatus === "Issue indicated") criticalFlags.push("Loan/mortgage/dispute issue was indicated — independent legal verification required");
  else if(disputeStatus === "Unclear") criticalFlags.push("Loan/mortgage/dispute status is unclear — independent legal verification required");

  if(isLegacyOwnerAnswer("q_712_papers", papersStatus)) criticalFlags.push("Previous property-papers/7/12 answer needs re-verification — no conclusion carried forward");
  else if(papersStatus === "Not available") criticalFlags.push("Property papers/7/12 were reported not available — verification required");
  else if(papersStatus === "Unclear") criticalFlags.push("Property papers/7/12 status is unclear — verification required");

  let total=Math.round(location+access+price+infrastructure+siteCondition+evidence+legalReadiness+risk);
  const dataSignals=[Boolean(p.location), intel.status==="ok"||intel.status==="partial", answeredCount>=5, Boolean(eco.effectivePrice&&eco.areaSqft), legalReadiness>=4, p.photos.length>=2];
  const signalCount=dataSignals.filter(Boolean).length;
  const confidence:Score["confidence"]=signalCount>=5?"HIGH":signalCount>=3?"MEDIUM":"LOW";
  let status:Score["status"]="UNDECIDED";
  if(confidence==="LOW") status="UNDECIDED";
  else if(criticalFlags.length) status="INVESTIGATE";
  else if(total>=72) status="STRONG";
  else if(total>=45) status="INVESTIGATE";
  else status="REJECT";

  if(legalReadiness<4) concerns.push("Legal-readiness information is incomplete");
  if(evidence<5) concerns.push("Evidence set is still incomplete");
  if(confidence==="LOW") concerns.push("Not enough evidence for a reliable site signal yet");
  const explanation=[
    `Location ${location}/15 · Access ${access}/15 · Price ${price}/15`,
    `Infrastructure ${infrastructure}/15 · Site ${siteCondition}/15`,
    `Evidence ${evidence}/10 · Legal readiness ${legalReadiness}/10 · Risk ${risk}/5`,
    ...positives.map(x=>`Positive: ${x}`), ...concerns.map(x=>`Check: ${x}`), ...criticalFlags.map(x=>`Critical: ${x}`)
  ];
  return { total, breakdown:{location,access,price,infrastructure,siteCondition,evidence,legalReadiness,risk}, status, confidence, explanation, positives, concerns, criticalFlags };
}

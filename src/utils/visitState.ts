import { PropertyRecord } from "../types";
import { smartQuestions } from "./fieldIntelligence";
import { computeScore } from "./scoring";

export type VisitSectionId = "identity"|"location"|"ground"|"economics"|"evidence"|"decision";
export type VisitSectionState = "NOT_STARTED"|"IN_PROGRESS"|"READY"|"NEEDS_ATTENTION";
export interface SectionState { id:VisitSectionId; label:string; state:VisitSectionState; done:number; total:number; }
const labels:Record<VisitSectionId,string>={identity:"Identity",location:"Location",ground:"Ground truth",economics:"Economics",evidence:"Evidence",decision:"Decision"};
const present=(v:unknown)=>typeof v==="string"?Boolean(v.trim()):v!==null&&v!==undefined&&v!==false;

export function visitSectionStates(p:PropertyRecord):SectionState[]{
  const identityChecks=[present(p.identity?.village),present(p.identity?.gatNo)||present(p.identity?.surveyNo)];
  const locationChecks=[Boolean(p.location),p.mapIntel.status==="ok"||p.mapIntel.status==="partial"];
  const questions=smartQuestions(p); const groundChecks=questions.map(q=>present(p.ownerAnswers[q.id]));
  const economicsChecks=[present(p.price.quotedPrice)||present(p.price.askingPrice),present(p.price.areaSqft)||present(p.price.areaGuntha)||present(p.price.areaAcre)];
  const evidenceChecks=[p.photos.length>=1,p.photos.length>=2];
  const score=computeScore(p); const decisionChecks=[score.confidence!=="LOW",p.finalStatus!=="UNDECIDED"||Boolean(p.followUp.trim())];
  const mk=(id:VisitSectionId,checks:boolean[],attention=false):SectionState=>{
    const done=checks.filter(Boolean).length,total=checks.length;
    let state:VisitSectionState=done===0?"NOT_STARTED":done===total?"READY":"IN_PROGRESS";
    if(attention&&done>0) state="NEEDS_ATTENTION";
    return {id,label:labels[id],state,done,total};
  };
  const poorGps=Boolean(p.location?.accuracy && p.location.accuracy>75);
  const mapFailed=p.mapIntel.status==="failed";
  return [mk("identity",identityChecks),mk("location",locationChecks,poorGps||mapFailed),mk("ground",groundChecks),mk("economics",economicsChecks),mk("evidence",evidenceChecks),mk("decision",decisionChecks,score.criticalFlags.length>0)];
}
export function visitCompletion(p:PropertyRecord){
 const s=visitSectionStates(p); const done=s.reduce((n,x)=>n+x.done,0), total=s.reduce((n,x)=>n+x.total,0); return total?Math.round(done/total*100):0;
}
export const sectionStateLabel:Record<VisitSectionState,string>={NOT_STARTED:"Not started",IN_PROGRESS:"In progress",READY:"Ready",NEEDS_ATTENTION:"Needs attention"};

import { PropertyRecord } from "../types";
import { smartQuestions } from "./fieldIntelligence";
export function visitCompleteness(p: PropertyRecord): number {
 let done=0,total=0; const mark=(ok:boolean)=>{total++;if(ok)done++};
 mark(Boolean(p.location)); mark(Boolean(p.identity?.village?.trim())); mark(Boolean(p.identity?.gatNo?.trim()||p.identity?.surveyNo?.trim()));
 mark(p.mapIntel.status==="ok"||p.mapIntel.status==="partial");
 for(const q of smartQuestions(p)) mark(Boolean((p.ownerAnswers[q.id]||"").trim()));
 mark(Boolean(p.price.quotedPrice||p.price.askingPrice)); mark(Boolean(p.price.areaSqft||p.price.areaGuntha));
 mark(p.photos.length>=2); mark(p.finalStatus!=="UNDECIDED");
 return total?Math.round(done/total*100):0;
}

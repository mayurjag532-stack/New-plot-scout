import { PropertyRecord } from "../types";
import { autoSignals, beforeYouLeave, evidencePrompts, fieldSnapshot, smartQuestions } from "../utils/fieldIntelligence";

export default function SmartInspection({property,onAnswer,onNotesChange}:{property:PropertyRecord;onAnswer:(id:string,v:string)=>void;onNotesChange:(v:string)=>void}){
 const signals=autoSignals(property.mapIntel), questions=smartQuestions(property), missing=beforeYouLeave(property), evidence=evidencePrompts(property), snapshot=fieldSnapshot(property);
 const answered=questions.filter(q=>(property.ownerAnswers[q.id]||"").trim()).length;
 return <div className="smart-stack">
   <section className="smart-console ps-fade" aria-label="Field intelligence summary">
    <div className="smart-head"><div><p className="ps-kicker">Plot Scout intelligence</p><h3 className="font-display !text-[20px]">{snapshot.headline}</h3><p>{snapshot.summary}</p></div><div className="smart-count" title="Confidence">{snapshot.confidence}</div></div>
    {snapshot.flags.length>0 && <div className="smart-flags" role="list" aria-label="Attention flags">{snapshot.flags.map(x=><span key={x} role="listitem">{x}</span>)}</div>}
    {signals.length>0 && <div className="signal-grid">{signals.map(s=><div className={`signal ${s.tone}`} key={s.label}><span>{s.label}</span><b>{s.value}</b><small>auto-detected</small></div>)}</div>}
    {signals.length===0 && <div className="auto-wait"><span className="pulse-dot"/>Capture location — Plot Scout will calculate roads, access and surroundings automatically.</div>}
   </section>
   <section className="smart-questions" aria-label="Field questions">
    <div className="smart-head compact"><div><p className="ps-kicker">Ground truth only</p><h3 className="font-display !text-[20px]">Only what the map cannot know</h3><p>Questions adapt to this site and your previous answers.</p></div><span className="smart-badge tabular-nums" aria-label={`${answered} of ${questions.length} answered`}>{answered}/{questions.length}</span></div>
    <div className="question-list">{questions.map((q,n)=>{const v=property.ownerAnswers[q.id]||"";const attention=!v&&q.priority==="critical";return <article className={`smart-q ps-stagger ${v?"done":attention?"needs-attention":""}`} style={{ animationDelay: `${Math.min(n,8)*40}ms` }} key={q.id}><div className="q-index" aria-hidden="true">{v?"✓":String(n+1).padStart(2,"0")}</div><div className="q-body"><div className="q-title-row"><h4>{q.title}</h4>{q.priority==="critical"&&<span className="risk-pill">Priority</span>}</div><p>{q.hint}</p><div className="option-row" role="group" aria-label={q.title}>{q.options.map(o=><button key={o} onClick={()=>onAnswer(q.id,o)} aria-pressed={v===o} className={v===o?"selected":""}>{o}</button>)}</div></div></article>})}</div>
    <textarea value={property.notes.site} onChange={e=>onNotesChange(e.target.value)} placeholder="Only add a note if something unusual matters…" rows={2} aria-label="Site notes"/>
   </section>
   {evidence.length>0 && <section className="evidence-coach" aria-label="Evidence suggestions"><div><p className="ps-kicker">Smart evidence</p><h3 className="font-display !text-[19px]">Capture only what matters here</h3></div><div className="evidence-prompt-row">{evidence.map(x=><span key={x}>{x}</span>)}</div></section>}
   <section className={`leave-gate ${missing.length===0?"ready":""}`} aria-label="Before you leave">
    <div><p className="ps-kicker">Before you leave</p><h3 className="font-display !text-[20px]">{missing.length===0?"Field evidence looks complete":"Don’t make a second trip"}</h3><p>{missing.length===0?"Core field checks are captured. Continue to economics and decision.":`${missing.length} useful item${missing.length>1?"s":""} still missing.`}</p></div>
    {missing.length>0 && <div className="leave-items">{missing.map((x,i)=><div key={x}><span aria-hidden="true">{i+1}</span>{x}</div>)}</div>}
   </section>
 </div>
}

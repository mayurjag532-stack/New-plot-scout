import { useState } from "react";
import { OpportunityLead, applyLocationVerification, isSafeSourceUrl, normalizeOpportunityLead } from "../leads";
import { StatusTag, Tone } from "./ui/StatusTag";

const STATUS_TONE: Record<OpportunityLead["status"],Tone>={INBOX:"neutral",UNVERIFIED:"warn",LOCATION_CONFLICT:"bad",READY_FOR_REVIEW:"good",PROMOTED:"good",REJECTED:"bad"};
export default function LeadInbox({leads,onDelete,onUpdate,embedded=false}:{leads:OpportunityLead[];onDelete:(id:string)=>void;onUpdate?:(lead:OpportunityLead)=>Promise<void>;embedded?:boolean}){
 const [open,setOpen]=useState<string|null>(null); const [verifying,setVerifying]=useState<string|null>(null); const [verifyMsg,setVerifyMsg]=useState<Record<string,string>>({});
 async function verifyLead(l:OpportunityLead){
  if(!l.sourceUrl){setVerifyMsg(m=>({...m,[l.id]:"No source URL available."}));return;}
  setVerifying(l.id); setVerifyMsg(m=>({...m,[l.id]:"Checking public source evidence..."}));
  try{
   const r=await fetch("/api/verify-lead",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:l.sourceUrl,title:l.sharedTitle,text:l.sharedText})});
   const d=await r.json(); if(!r.ok) throw new Error(d?.error||`Verify ${r.status}`);
   const now=Date.now();
   const evidence=[...l.evidence,{id:`ev_${now}_verify`,kind:"verification_snapshot" as const,value:JSON.stringify(d),capturedAt:now,sourceUrl:l.sourceUrl}];
   let next=normalizeOpportunityLead({...l,evidence,updatedAt:now});
   if(d?.location && Object.values(d.location).some(Boolean)) next=applyLocationVerification(next,d.location);
   if(onUpdate) await onUpdate(next);
   const parts=[d?.sourceReachable?"source reachable":"source limited",d?.saleIntent?"sale signal found":"sale signal not proven",d?.locationEstablished?"location clues found":"location not established"];
   setVerifyMsg(m=>({...m,[l.id]:parts.join(" - ")}));
  }catch(e:any){setVerifyMsg(m=>({...m,[l.id]:`Verification stopped safely: ${e?.message||"Unknown error"}`}));}finally{setVerifying(null);}
 }
 return <section className="ps-led" aria-label="Lead inbox">
  <header><p className="ps-kicker">Lead inbox</p><h3 className="font-display">Evidence first</h3><p>Nothing here is actionable until the location is verified.</p></header>
  {leads.length===0?<div className="ps-empty"><svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="32" cy="32" r="22" strokeDasharray="2 4"/><circle cx="32" cy="32" r="11"/><path d="M32 6v10M32 48v10M6 32h10M48 32h10"/></svg><p className="font-display">No captured leads yet</p><small>Share an Instagram or property post to Plot Scout, or run a scan above. Leads you capture appear here with their source and verification state.</small></div>
  :<ol className="ps-led-list">{leads.map((l,i)=>{const expanded=open===l.id;const tone=STATUS_TONE[l.status];const linkSafe=isSafeSourceUrl(l.sourceUrl);return <li key={l.id} className="ps-led-item ps-stagger" style={{animationDelay:`${Math.min(i,8)*40}ms`}}>
   <button onClick={()=>setOpen(expanded?null:l.id)} aria-expanded={expanded} className="ps-led-head"><span className={`ps-led-rail is-${tone}`} aria-hidden="true"/><span className="ps-led-main"><span className="ps-led-title">{l.sharedTitle||l.sourceUrl||"Shared property lead"}</span><span className="ps-led-meta">{new Date(l.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}{l.source==="instagram_share"?" · Instagram":""}{typeof l.distanceKm==="number"?` · ${l.distanceKm<1?`${Math.round(l.distanceKm*1000)} m`:`${l.distanceKm.toFixed(1)} km`} away`:""}</span>{l.sharedText&&<span className="ps-led-text">{l.sharedText}</span>}</span><StatusTag tone={tone} label={l.status.replace(/_/g," ")}/></button>
   {expanded&&<div className="ps-led-body ps-fade">{linkSafe&&<div><p className="ps-label">Source</p><a href={l.sourceUrl} target="_blank" rel="noreferrer" className="ps-led-link">{l.sourceUrl}</a></div>}
    <div className="ps-led-actions"><button disabled={verifying===l.id||!linkSafe} onClick={()=>verifyLead(l)} className="ps-btn-secondary">{verifying===l.id?"Verifying…":"Verify lead"}</button><button onClick={()=>onDelete(l.id)} className="ps-led-del">Delete lead</button></div>
    {verifyMsg[l.id]&&<p className="ps-led-msg" role="status">{verifyMsg[l.id]}</p>}
    <div><p className="ps-label">Provenance</p><ol className="ps-led-ledger">{l.evidence.map(e=><li key={e.id}><span>{e.kind.replace(/_/g," ")}</span><p>{e.value}</p></li>)}</ol></div>
    <div className={`ps-led-gate is-${tone}`}><div><p className="ps-label">Location verification</p><p>{l.verification.humanReadableReason}</p></div><StatusTag tone={tone} label={l.verification.status.replace(/_/g," ")}/></div>
   </div>}
  </li>})}</ol>}
 </section>;
}

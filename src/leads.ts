import { LeadClaim } from "./claims";
import { LocationGateResult, LocationHierarchy, verifyLocation } from "./utils/locationGate";

export type LeadStatus = "INBOX" | "UNVERIFIED" | "LOCATION_CONFLICT" | "READY_FOR_REVIEW" | "PROMOTED" | "REJECTED";
export type LeadSource = "share_target" | "instagram_share" | "discovery_provider" | "manual_url" | "manual_text";

export interface LeadEvidence {
  id: string;
  kind: "shared_title" | "shared_text" | "source_url" | "verification_snapshot";
  value: string;
  capturedAt: number;
  sourceUrl?: string;
}

export interface OpportunityLead {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: LeadStatus;
  source: LeadSource;
  sourceUrl: string;
  sharedTitle: string;
  sharedText: string;
  evidence: LeadEvidence[];
  claims: LeadClaim[];
  sourceLocation: LocationHierarchy;
  verification: LocationGateResult;
  /** Distance from the search scope at discovery time, in km. Only meaningful for source:"discovery_provider" leads — never treated as location evidence. */
  distanceKm?: number;
}

export function safeHttpUrl(value?: string): string {
  const raw=(value||"").trim();
  if(!raw) return "";
  try { const u=new URL(raw); return (u.protocol==="http:"||u.protocol==="https:") ? u.href : ""; } catch { return ""; }
}
export function isSafeSourceUrl(value?: string): boolean { return !!safeHttpUrl(value); }

function blankGate(): LocationGateResult {
  return verifyLocation({sourceLocation:{},sourceEvidenceIds:[]});
}

export function normalizeOpportunityLead(raw: OpportunityLead): OpportunityLead {
  const sourceUrl=safeHttpUrl(raw.sourceUrl);
  const evidence=(raw.evidence||[]).map(e=>({ ...e, sourceUrl:safeHttpUrl(e.sourceUrl)||undefined }));
  const sourceLocation=raw.sourceLocation||{};
  const verification=raw.verification && Array.isArray((raw.verification as LocationGateResult).reasonCodes)
    ? raw.verification as LocationGateResult
    : verifyLocation({sourceLocation,sourceEvidenceIds:evidence.map(e=>e.id)});
  const status: LeadStatus = verification.status==="LOCATION_CONFLICT" ? "LOCATION_CONFLICT" : raw.status==="PROMOTED" ? "PROMOTED" : raw.status==="REJECTED" ? "REJECTED" : verification.status==="VERIFIED" ? "READY_FOR_REVIEW" : "UNVERIFIED";
  return {...raw,sourceUrl,evidence,claims:raw.claims||[],sourceLocation,verification,status};
}

export function applyLocationVerification(lead: OpportunityLead, sourceLocation: LocationHierarchy): OpportunityLead {
  const verification=verifyLocation({sourceLocation,sourceEvidenceIds:lead.evidence.map(e=>e.id)});
  const status: LeadStatus=verification.status==="LOCATION_CONFLICT"?"LOCATION_CONFLICT":verification.status==="VERIFIED"?"READY_FOR_REVIEW":"UNVERIFIED";
  return {...lead,sourceLocation,verification,status,updatedAt:Date.now()};
}

export function newSharedLead(input: { title?: string; text?: string; url?: string }): OpportunityLead {
  const now=Date.now();
  const title=(input.title||"").trim(); const text=(input.text||"").trim(); const url=safeHttpUrl(input.url);
  const evidence: LeadEvidence[]=[];
  if(title) evidence.push({id:`ev_${now}_title`,kind:"shared_title",value:title,capturedAt:now,sourceUrl:url||undefined});
  if(text) evidence.push({id:`ev_${now}_text`,kind:"shared_text",value:text,capturedAt:now,sourceUrl:url||undefined});
  if(url) evidence.push({id:`ev_${now}_url`,kind:"source_url",value:url,capturedAt:now,sourceUrl:url});
  const instagram = /(^|\.)instagram\.com$/i.test((()=>{try{return new URL(url).hostname}catch{return ""}})());
  return normalizeOpportunityLead({id:`lead_${now}_${Math.random().toString(36).slice(2,8)}`,createdAt:now,updatedAt:now,status:"UNVERIFIED",source:instagram?"instagram_share":"share_target",sourceUrl:url,sharedTitle:title,sharedText:text,evidence,claims:[],sourceLocation:{},verification:blankGate()});
}


export function newDiscoveryLead(candidate: any): OpportunityLead {
  const lead=newSharedLead({title:String(candidate?.rawTitle||"Land opportunity"),text:String(candidate?.rawText||""),url:String(candidate?.sourceUrl||"")});
  const now=Date.now();
  const distanceKm = Number.isFinite(Number(candidate?.distanceKm)) ? Number(candidate.distanceKm) : undefined;
  const snapshot=JSON.stringify({providerId:candidate?.providerId||"unknown",externalId:candidate?.externalId||"",saleIntent:Boolean(candidate?.saleIntent),distanceKm:distanceKm??null,provenance:candidate?.provenance||null});
  return normalizeOpportunityLead({...lead,source:"discovery_provider",distanceKm,evidence:[...lead.evidence,{id:`ev_${now}_discovery`,kind:"verification_snapshot",value:snapshot,capturedAt:now,sourceUrl:lead.sourceUrl||undefined}]});
}

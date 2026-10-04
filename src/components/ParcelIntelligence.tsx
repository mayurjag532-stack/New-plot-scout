import { useState } from "react";
import { CapturedLocation, ParcelIntelligence, PropertyIdentity, emptyParcelIntelligence } from "../types";
import { distanceMeters, extractLatLngFromMapsUrl, formatDistance, googleMapsPointUrl } from "../utils/geo";

const MAHABHUMI="https://mahabhumi.gov.in/";
const BHULEKH="https://bhulekh.mahabhumi.gov.in/";
const JURISDICTION="https://mahavillages.mahabhumi.gov.in/newjurisdiction.php";

function assess(field:CapturedLocation|null, lat:number,lng:number){
 if(!field)return {m:null,a:"CANNOT_DETERMINE" as const};
 const d=distanceMeters(field.lat,field.lng,lat,lng); const uncertainty=field.accuracy??75;
 return {m:Math.round(d),a:(d<=Math.max(100,uncertainty+50)?"CONSISTENT":d>Math.max(250,uncertainty*2)?"VERIFY":"CANNOT_DETERMINE") as ParcelIntelligence["mismatchAssessment"]};
}
export default function ParcelIntelligencePanel({identity,fieldLocation,value,onChange}:{identity?:PropertyIdentity;fieldLocation:CapturedLocation|null;value?:ParcelIntelligence;onChange:(v:ParcelIntelligence)=>void}){
 const intel=value??emptyParcelIntelligence(); const [paste,setPaste]=useState(""); const [msg,setMsg]=useState("");
 const hasId=Boolean(identity?.gatNo?.trim()||identity?.surveyNo?.trim()); const hasPlace=Boolean(identity?.district?.trim()&&identity?.taluka?.trim()&&identity?.village?.trim());
 function savePoint(){const p=extractLatLngFromMapsUrl(paste);if(!p){setMsg("Paste coordinates or a full Google Maps URL containing coordinates.");return;}const x=assess(fieldLocation,p.lat,p.lng);onChange({...intel,status:"user_confirmed_location",checkedAt:Date.now(),parcelLat:p.lat,parcelLng:p.lng,locationSource:"USER_CONFIRMED_FROM_OFFICIAL_MAP",mismatchMeters:x.m,mismatchAssessment:x.a});setMsg("Reference location saved. It remains user-confirmed, not a legal boundary.");}
 function markOfficial(){onChange({...intel,status:"needs_official_verification",checkedAt:Date.now()});setMsg("Official verification handoff recorded. Plot Scout has not claimed a parcel match.");}
 return <section className="bg-field-card border border-field-line rounded-xl p-4 space-y-3 ps-parcel">
  <div><h3 className="text-field-text font-semibold text-[15px]">Gat / Survey verification</h3><p className="text-field-muted text-sm mt-1">Plot Scout does not fabricate cadastral boundaries. Maharashtra official services require their own interactive verification/login for authoritative records.</p></div>
  {!hasId||!hasPlace?<div className="bg-field-panel border border-field-line rounded-lg p-3 text-xs text-field-muted">Enter District, Taluka, Village and Gat/Survey number above to prepare the official verification handoff.</div>:<>
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><a href={BHULEKH} target="_blank" rel="noreferrer" onClick={markOfficial} className="ps-link-btn is-primary">Open official 7/12</a><a href={JURISDICTION} target="_blank" rel="noreferrer" onClick={markOfficial} className="ps-link-btn">Find Survey/Gat jurisdiction</a><a href={MAHABHUMI} target="_blank" rel="noreferrer" onClick={markOfficial} className="ps-link-btn">Mahabhumi services</a></div>
   <div className="bg-field-panel rounded-lg p-3 text-xs text-field-muted"><span className="text-field-text font-medium">Prepared identity:</span> {identity?.village}, {identity?.taluka}, {identity?.district} · {identity?.gatNo?`Gat ${identity.gatNo}`:`Survey ${identity?.surveyNo}`}{identity?.hissaNo?` · Hissa ${identity.hissaNo}`:""}</div>
   <div className="border-t border-field-line pt-3"><label className="text-xs text-field-muted block mb-1">Optional map reference after you identify the parcel on an official/map source</label><div className="flex gap-2"><input value={paste} onChange={e=>setPaste(e.target.value)} placeholder="Google Maps URL or lat,lng" className="flex-1 min-w-0 bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"/><button onClick={savePoint} className="ps-btn-secondary !px-4">Save reference</button></div></div>
  </>}
  {intel.parcelLat!=null&&intel.parcelLng!=null&&<div className="bg-field-panel border border-field-line rounded-lg p-3 text-xs space-y-1"><div className="flex justify-between gap-2"><span className="text-field-muted">Reference provenance</span><span className="text-field-text">USER CONFIRMED · approximate</span></div>{intel.mismatchMeters!=null&&<div className="flex justify-between gap-2"><span className="text-field-muted">Field GPS ↔ reference</span><span className={intel.mismatchAssessment==="VERIFY"?"text-field-bad":"text-field-text"}>{formatDistance(intel.mismatchMeters)} · {intel.mismatchAssessment.replace(/_/g," ")}</span></div>}<a href={googleMapsPointUrl(intel.parcelLat,intel.parcelLng)} target="_blank" rel="noreferrer" className="text-field-accent inline-block pt-1">Open reference in Google Maps</a></div>}
  {msg&&<p className="text-xs text-field-accent">{msg}</p>}
  <p className="text-[10px] text-field-muted">Authoritative status is never set automatically. Digitally signed Maharashtra land records/official professional verification remain the source for legal use.</p>
 </section>;
}

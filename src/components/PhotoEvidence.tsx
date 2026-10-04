import { useRef, useState } from "react";
import { PhotoCategory, PropertyPhoto } from "../types";

const CATEGORIES: { id: PhotoCategory; label: string }[] = [
  { id: "front_road", label: "Front road" }, { id: "plot", label: "Plot" },
  { id: "left_side", label: "Left side" }, { id: "right_side", label: "Right side" },
  { id: "rear", label: "Rear" }, { id: "surrounding", label: "Surroundings" },
  { id: "access_road", label: "Access road" }, { id: "documents", label: "Documents" }
];
const MAX_DIMENSION=1600, JPEG_QUALITY=.78;
function resizeImage(file:File):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error("Could not read photo file."));r.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error("Could not decode photo."));img.onload=()=>{let {width,height}=img;if(width>MAX_DIMENSION||height>MAX_DIMENSION){const scale=MAX_DIMENSION/Math.max(width,height);width=Math.round(width*scale);height=Math.round(height*scale);}const c=document.createElement("canvas");c.width=width;c.height=height;const ctx=c.getContext("2d");if(!ctx)return reject(new Error("Image processing is not supported on this device."));ctx.drawImage(img,0,0,width,height);resolve(c.toDataURL("image/jpeg",JPEG_QUALITY));};img.src=r.result as string;};r.readAsDataURL(file);});}

function XIcon() { return <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function CameraEmptyIcon() { return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a2 2 0 0 1 2-2h1.2a1 1 0 0 0 .9-.5l.6-1a1 1 0 0 1 .9-.5h4.8a1 1 0 0 1 .9.5l.6 1a1 1 0 0 0 .9.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.2" /></svg>; }

export default function PhotoEvidence({photos,onAdd,onRemove,onUpdate}:{photos:PropertyPhoto[];onAdd:(p:PropertyPhoto)=>void;onRemove:(id:string)=>void;onUpdate?:(id:string,patch:Partial<PropertyPhoto>)=>void;}){
 const [activeCategory,setActiveCategory]=useState<PhotoCategory>("plot"),[error,setError]=useState(""),[busy,setBusy]=useState(false); const inputRef=useRef<HTMLInputElement>(null);
 async function handleFiles(e:React.ChangeEvent<HTMLInputElement>){const files=Array.from(e.target.files||[]);if(!files.length)return;setError("");setBusy(true);try{for(const file of files){const dataUrl=await resizeImage(file);onAdd({id:`photo_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,category:activeCategory,dataUrl,addedAt:Date.now(),caption:""});}}catch(err){setError(err instanceof Error?err.message:"Could not add evidence.");}finally{setBusy(false);if(inputRef.current)inputRef.current.value="";}}
 const grouped=CATEGORIES.map(c=>({...c,count:photos.filter(p=>p.category===c.id).length}));
 const coveredCategories=grouped.filter(c=>c.count>0).length;
 const pct=Math.round(coveredCategories/CATEGORIES.length*100);
 const fmtTime=(t:number)=>new Date(t).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
 return <section className="ps-ev" aria-label="Evidence vault">
   <header className="ps-ev-head">
     <div>
       <p className="ps-label">Coverage</p>
       <p className="ps-ev-cov font-display tabular-nums">{coveredCategories}<span> of {CATEGORIES.length} views</span></p>
     </div>
     <p className="ps-ev-priv">{photos.length} item{photos.length===1?"":"s"} · private on this device</p>
   </header>
   <div className="ps-ev-meter" role="img" aria-label={`${coveredCategories} of ${CATEGORIES.length} evidence views captured (${pct}%)`}>{grouped.map(c=><i key={c.id} className={c.count?"is-on":""}/>)}</div>

   <div className="ps-ev-cats" role="tablist" aria-label="Evidence categories">
     {grouped.map(c=><button key={c.id} role="tab" aria-selected={activeCategory===c.id} onClick={()=>setActiveCategory(c.id)} className={c.count?"has":""}>
       <span className="ps-ev-tick" aria-hidden="true">{c.count?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>:null}</span>{c.label}{c.count?<em>{c.count}</em>:null}
     </button>)}
   </div>

   <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" id="evidence-input"/>
   <label htmlFor="evidence-input" className={`ps-btn-primary ps-ev-add ${busy?"is-busy":""}`}><CameraEmptyIcon/>{busy?"Processing evidence…":`Capture · ${CATEGORIES.find(c=>c.id===activeCategory)?.label}`}</label>
   {error&&<p role="alert" className="ps-ev-err">{error}</p>}

   {photos.length>0?(
     <ol className="ps-ev-list">
       {photos.map((p,i)=>(
         <li key={p.id} className="ps-ev-item ps-stagger" style={{ animationDelay: `${Math.min(i,8)*40}ms` }}>
           <div className="ps-ev-shot">
             <img src={p.dataUrl} loading="lazy" decoding="async" alt={p.caption || `${CATEGORIES.find(c=>c.id===p.category)?.label} evidence photo`}/>
             <button onClick={()=>{if(confirm("Remove this evidence item?"))onRemove(p.id)}} className="ps-ev-x" aria-label="Remove evidence"><XIcon/></button>
           </div>
           <div className="ps-ev-meta">
             <p className="ps-ev-cat">{CATEGORIES.find(c=>c.id===p.category)?.label}</p>
             <input value={p.caption||""} onChange={e=>onUpdate?.(p.id,{caption:e.target.value})} placeholder="Add a short caption…" aria-label="Photo caption"/>
             <p className="ps-ev-stamp tabular-nums"><span aria-hidden="true"/><time dateTime={new Date(p.addedAt).toISOString()}>{fmtTime(p.addedAt)}</time> · captured on this device</p>
           </div>
         </li>
       ))}
     </ol>
   ):(
     <div className="ps-empty ps-ev-empty">
       <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="8" y="16" width="48" height="36" rx="6"/><circle cx="32" cy="34" r="9"/><path d="M22 16l3-6h14l3 6" strokeLinejoin="round"/></svg>
       <p className="font-display">No evidence captured yet</p>
       <small>Capture access, plot edges, surroundings and relevant documents. Each photo is timestamped as field evidence.</small>
     </div>
   )}
 </section>;
}

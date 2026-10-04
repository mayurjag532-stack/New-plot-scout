import { useEffect, useRef, useState } from "react";
import { PropertyRecord } from "../types";
import { exportAllJson, exportAllCsv } from "../utils/export";
import { createFullBackup, deleteAllProperties, getStorageInfo, previewBackup, previewRestoreImpact, requestPersistentStorage, restoreBackup } from "../db";
import type { BackupPreview, RestoreImpact, StorageInfo } from "../db";
import { getPlan, setPlan, PLAN_META, Plan, isDeveloperPlanPreview } from "../entitlements";
import { BuyerProfile, clearBuyerProfile, saveBuyerProfile } from "../personalization";
import { setTheme } from "../utils/theme";
import AccountAccess from "./AccountAccess";
import { StatusTag } from "./ui/StatusTag";

function fmtBytes(v:number|null){if(v===null)return "Unavailable"; if(v<1024*1024)return `${(v/1024).toFixed(1)} KB`; if(v<1024*1024*1024)return `${(v/1024/1024).toFixed(1)} MB`;return `${(v/1024/1024/1024).toFixed(2)} GB`;}
function relative(ts:number){const d=Math.floor((Date.now()-ts)/86400000);return d<=0?"Today":d===1?"Yesterday":d<30?`${d} days ago`:new Date(ts).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});}
function fmtDate(v:number|null){return v?new Date(v).toLocaleString():"No full backup recorded yet";}

type ThemeChoice = "light" | "dark" | "system";

/* Bear-style grouped rows: small-caps label, one rounded container, hairline-divided rows */
function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="ps-set-group">
      <h3 className="ps-set-title">{title}</h3>
      <div className="ps-set-rows">{children}</div>
      {note && <p className="ps-set-note">{note}</p>}
    </section>
  );
}
function Row({ label, value, hint, onClick, tone, children }: { label: string; value?: React.ReactNode; hint?: string; onClick?: () => void; tone?: "danger" | "accent"; children?: React.ReactNode }) {
  const inner = (
    <>
      <span className="ps-set-label"><span>{label}</span>{hint && <small>{hint}</small>}</span>
      {value != null && <span className="ps-set-value tabular-nums">{value}</span>}
      {children}
      {onClick && <svg viewBox="0 0 24 24" className="ps-set-chev" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>}
    </>
  );
  return onClick
    ? <button type="button" className={`ps-set-row is-action ${tone ? `is-${tone}` : ""}`} onClick={onClick}>{inner}</button>
    : <div className={`ps-set-row ${tone ? `is-${tone}` : ""}`}>{inner}</div>;
}

function ThemeSelector() {
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    try {
      const s = localStorage.getItem("plot-scout-theme");
      if (s === "light" || s === "dark") return s;
    } catch { /* ignore */ }
    return "system";
  });

  function apply(c: ThemeChoice) {
    setChoice(c);
    if (c === "system") {
      try { localStorage.removeItem("plot-scout-theme"); } catch { /* ignore */ }
      const dark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const t = dark ? "dark" : "light";
      if (typeof document !== "undefined") document.documentElement.dataset.theme = t;
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("plot-scout-theme-change", { detail: { theme: t } }));
    } else {
      setTheme(c);
    }
  }

  /* Follow the OS while "System" is selected */
  useEffect(() => {
    if (choice !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => apply("system");
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice]);

  const options: { id: ThemeChoice; label: string; hint: string }[] = [
    { id: "light", label: "Light", hint: "Warm ivory" },
    { id: "dark", label: "Dark", hint: "Graphite spatial" },
    { id: "system", label: "System", hint: "Follows device" },
  ];

  return (
    <div role="radiogroup" aria-label="Appearance" className="ps-seg ps-set-seg">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={choice === o.id} aria-pressed={choice === o.id} onClick={() => apply(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Settings({properties,onDataChanged,buyerProfile}:{properties:PropertyRecord[];onDataChanged:()=>void;buyerProfile:BuyerProfile;}) {
  const [confirmClear,setConfirmClear]=useState(false); const [profile,setProfile]=useState<BuyerProfile>(buyerProfile); const [plan,setCurrentPlan]=useState<Plan>("PRO"); const [info,setInfo]=useState<StorageInfo|null>(null); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [restoreFile,setRestoreFile]=useState<File|null>(null); const [preview,setPreview]=useState<BackupPreview|null>(null); const [impact,setImpact]=useState<RestoreImpact|null>(null); const [restoreMode,setRestoreMode]=useState<"merge"|"replace">("merge"); const fileRef=useRef<HTMLInputElement>(null);
  async function refreshInfo(){try{setInfo(await getStorageInfo());}catch(e){setError(e instanceof Error?e.message:"Storage information unavailable.");}}
  useEffect(()=>{refreshInfo(); const handler=(e:Event)=>setError((e as CustomEvent).detail?.message||"A storage error occurred."); window.addEventListener("plot-scout-storage-error",handler);return()=>window.removeEventListener("plot-scout-storage-error",handler);},[]);
  async function backup(){setError("");setMessage("Creating full backup…");try{const p=await createFullBackup();setMessage(`Backup created: ${p.propertyCount} properties, ${p.photoCount} photos.`);await refreshInfo();}catch(e){setMessage("");setError(e instanceof Error?e.message:"Backup failed.");}}
  async function chooseBackup(file:File|undefined){if(!file)return;setError("");setMessage("Validating backup…");try{const [p,i]=await Promise.all([previewBackup(file),previewRestoreImpact(file)]);setRestoreFile(file);setPreview(p);setImpact(i);setMessage("");}catch(e){setRestoreFile(null);setPreview(null);setImpact(null);setMessage("");setError(e instanceof Error?e.message:"Invalid backup.");}}
  async function restore(){if(!restoreFile)return;setError("");setMessage("Restoring and verifying…");try{await restoreBackup(restoreFile,restoreMode);setMessage("Restore completed and verified.");setRestoreFile(null);setPreview(null);setImpact(null);if(fileRef.current)fileRef.current.value="";await onDataChanged();await refreshInfo();}catch(e){setMessage("");setError(e instanceof Error?e.message:"Restore failed. Existing data was preserved where possible.");}}
  async function clearAll(){try{await deleteAllProperties();setConfirmClear(false);setMessage("All properties deleted. Recovery metadata is retained temporarily.");await onDataChanged();await refreshInfo();}catch(e){setError(e instanceof Error?e.message:"Delete failed.");}}
  useEffect(()=>setProfile(buyerProfile),[buyerProfile]);
  useEffect(()=>{const h=(e:Event)=>setCurrentPlan("PRO");window.addEventListener("plot-scout-plan-change",h);return()=>window.removeEventListener("plot-scout-plan-change",h);},[]);
  function patchProfile(patch:Partial<BuyerProfile>){setProfile(v=>({...v,...patch}));}
  function saveProfile(){const next=saveBuyerProfile(profile);setProfile(next);setMessage("Personalisation saved. New visits will use these criteria automatically.");}
  function resetProfile(){const next=clearBuyerProfile();setProfile(next);setMessage("Personalisation profile cleared.");}
  async function persist(){const ok=await requestPersistentStorage();setMessage(ok===true?"Persistent storage granted by this browser.":ok===false?"Browser did not grant persistent storage. Keep regular backups.":"Persistent storage is not supported here.");await refreshInfo();}

  const backupLabel = info?.lastBackupAt ? relative(info.lastBackupAt) : "Never";
  const quotaPct = info?.usage != null && info?.quota ? Math.min(100, (info.usage / info.quota) * 100) : null;
  const [persOpen, setPersOpen] = useState(false);

  return <div className="ps-set">
    <header className="ps-set-head ps-rise">
      <p className="ps-kicker">Device &amp; privacy</p>
      <h2 className="font-display">Settings</h2>
      <p className="ps-set-lede">Everything here lives on this device. Nothing is uploaded unless you export it.</p>
    </header>
    {(message||error)&&<div role="status" className={`ps-set-toast ${error?"is-error":""}`}>{error||message}</div>}

    <Group title="Appearance">
      <Row label="Theme" hint="Light and dark are both designed"><ThemeSelector/></Row>
    </Group>

    <Group title="Account"><div className="ps-set-embed"><AccountAccess/></div></Group>

    <Group title="Personalisation" note="Saved criteria guide Buyer Fit; they never rewrite objective property facts or legal verification.">
      <Row label="Buyer criteria" hint={profile.enabled ? (profile.name || "My Land Criteria") : "Off — neutral workflow"} value={profile.enabled ? "On" : "Off"} onClick={()=>setPersOpen(v=>!v)} />
      {persOpen && <div className="ps-set-embed ps-fade">
        <div className="personalisation-card">
                <div className="personalisation-head"><div><p className="ps-kicker">Saved context</p><h3>Personalisation</h3><p>Tell Plot Scout your buying criteria once. Turn it off anytime to use the neutral V3.2 workflow.</p></div><button type="button" aria-pressed={profile.enabled} onClick={()=>{const next=saveBuyerProfile({...profile,enabled:!profile.enabled});setProfile(next)}} className={`profile-switch ${profile.enabled?"on":""}`}><span/>{profile.enabled?"ON":"OFF"}</button></div>
                <div className={`profile-form ${profile.enabled?"":"muted"}`}>
                  <label>Profile name<input value={profile.name} onChange={e=>patchProfile({name:e.target.value})} placeholder="My Land Criteria"/></label>
                  <div className="profile-grid"><label>Budget min ₹<input type="number" value={profile.budgetMin??""} onChange={e=>patchProfile({budgetMin:e.target.value?Number(e.target.value):null})}/></label><label>Budget max ₹<input type="number" value={profile.budgetMax??""} onChange={e=>patchProfile({budgetMax:e.target.value?Number(e.target.value):null})}/></label></div>
                  <label>Preferred locations<input value={profile.preferredLocations} onChange={e=>patchProfile({preferredLocations:e.target.value})} placeholder="e.g. Saswad Road, Hadapsar"/><small>Separate multiple areas with commas.</small></label>
                  <div className="profile-grid"><label>Min area · guntha<input type="number" step="0.1" value={profile.minAreaGuntha??""} onChange={e=>patchProfile({minAreaGuntha:e.target.value?Number(e.target.value):null})}/></label><label>Max area · guntha<input type="number" step="0.1" value={profile.maxAreaGuntha??""} onChange={e=>patchProfile({maxAreaGuntha:e.target.value?Number(e.target.value):null})}/></label></div>
                  <label>Intended use<select value={profile.intendedUse} onChange={e=>patchProfile({intendedUse:e.target.value as BuyerProfile["intendedUse"]})}><option value="INVESTMENT">Investment</option><option value="HOME">Home</option><option value="FARM">Farm</option><option value="COMMERCIAL">Commercial</option><option value="OTHER">Other</option></select></label>
                  <div className="profile-grid"><label>Highway requirement<select value={profile.highwayRequirement} onChange={e=>patchProfile({highwayRequirement:e.target.value as BuyerProfile["highwayRequirement"]})}><option value="IGNORE">Doesn’t matter</option><option value="PREFERRED">Preferred</option><option value="MANDATORY">Mandatory</option></select></label><label>Max highway distance · m<input type="number" value={profile.maxHighwayDistanceM??""} onChange={e=>patchProfile({maxHighwayDistanceM:e.target.value?Number(e.target.value):null})} placeholder="e.g. 100"/></label></div>
                  <div className="profile-grid"><label>Vehicle access<select value={profile.carAccessRequirement} onChange={e=>patchProfile({carAccessRequirement:e.target.value as BuyerProfile["carAccessRequirement"]})}><option value="IGNORE">Doesn’t matter</option><option value="PREFERRED">Preferred</option><option value="MANDATORY">Mandatory</option></select></label><label>Minimum road width · ft<input type="number" value={profile.minRoadWidthFt??""} onChange={e=>patchProfile({minRoadWidthFt:e.target.value?Number(e.target.value):null})}/></label></div>
                  <label>Risk tolerance<select value={profile.riskTolerance} onChange={e=>patchProfile({riskTolerance:e.target.value as BuyerProfile["riskTolerance"]})}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
                  <label>What matters most<textarea rows={2} value={profile.priorities} onChange={e=>patchProfile({priorities:e.target.value})} placeholder="e.g. future appreciation, quiet area, wide frontage"/></label>
                  <label>Absolute deal-breakers<textarea rows={2} value={profile.dealBreakers} onChange={e=>patchProfile({dealBreakers:e.target.value})} placeholder="e.g. no clear access, nala nearby"/></label>
                  <p className="profile-note">Blank fields are ignored. Saved preferences guide Buyer Fit; they never rewrite objective property facts or legal verification.</p>
                  <div className="profile-actions"><button onClick={saveProfile}>Save criteria</button><button className="secondary" onClick={resetProfile}>Clear profile</button></div>
                </div>
              </div>
      </div>}
    </Group>

    <Group title="Plan" note="Backups, restore and privacy controls stay available on every plan. Data safety is never paywalled.">
      <Row label="Product access" hint="Capabilities are set by an entitlement layer" value={PLAN_META[plan].name} />
      {isDeveloperPlanPreview()
        ? <Row label="Preview plan" hint="Developer preview only — disabled in production">
            <div className="ps-seg ps-set-seg" role="radiogroup" aria-label="Preview plan">{(["BASIC","ADVANCED","PRO"] as Plan[]).map(x=><button key={x} role="radio" aria-checked={plan===x} aria-pressed={plan===x} onClick={()=>{setPlan("PRO");setCurrentPlan("PRO")}}>{PLAN_META[x].name}</button>)}</div>
          </Row>
        : <Row label="Verification" hint="Granted only by a verified server-side purchase. If verification is unavailable, access falls back to Basic." />}
      <Row label="Basic" hint="Visits, GPS, checklist, pricing, photos, local data safety" />
      <Row label="Advanced" hint="Adds map intelligence and the deeper decision workflow" />
      <Row label="Pro" hint="Adds portfolio comparison and professional reporting" />
    </Group>

    <Group title="On this device" note="Storage limits are set by your browser. Persistent storage lowers the risk of automatic cleanup, but it is not a substitute for a backup.">
      <Row label="Properties" value={info?.propertyCount ?? properties.length} />
      <Row label="Photos" value={info?.photoCount ?? "—"} />
      <Row label="Storage used" value={fmtBytes(info?.usage ?? null)}>
        {quotaPct != null && <span className="ps-set-meter" aria-hidden="true"><i style={{ width: `${Math.max(2, quotaPct)}%` }} /></span>}
      </Row>
      <Row label="Site quota" value={fmtBytes(info?.quota ?? null)} />
      <Row label="Recovery points" value={info?.recoveryCount ?? "—"} />
      <Row label="Persistent storage" value={<StatusTag tone={info?.persisted===true?"good":info?.persisted===false?"bad":"neutral"} label={info?.persisted===true?"Granted":info?.persisted===false?"Not granted":"Unavailable"} />} />
      {info?.persisted===false && <Row label="Request persistent storage" tone="accent" onClick={persist} />}
    </Group>

    <Group title="Backup &amp; restore" note="A full backup includes properties, photos, notes, map results, checklists, prices and statuses in one integrity-checked file.">
      <Row label="Last full backup" value={backupLabel} hint={info?.lastBackupAt ? fmtDate(info.lastBackupAt) : "No full backup recorded yet"} />
      <Row label="Create full backup" tone="accent" onClick={backup} />
      <div className="ps-set-row ps-set-restore">
        <span className="ps-set-label"><span>Restore from backup</span><small>Choose a .plotscout file to preview before anything changes</small></span>
        <input ref={fileRef} type="file" accept=".plotscout,application/json" onChange={e=>chooseBackup(e.target.files?.[0])} className="ps-set-file" aria-label="Choose backup file" />
      </div>
      {preview && <div className="ps-set-embed ps-fade ps-set-preview">
        <p className="ps-set-ok">Valid Plot Scout backup ✓</p>
        <p>{new Date(preview.createdAt).toLocaleString()} · {preview.propertyCount} properties · {preview.photoCount} photos · format v{preview.formatVersion}</p>
        <div className="ps-seg ps-set-seg" role="radiogroup" aria-label="Restore mode">
          <button role="radio" aria-checked={restoreMode==="merge"} aria-pressed={restoreMode==="merge"} onClick={()=>setRestoreMode("merge")}>Merge</button>
          <button role="radio" aria-checked={restoreMode==="replace"} aria-pressed={restoreMode==="replace"} onClick={()=>setRestoreMode("replace")}>Replace all</button>
        </div>
        <p>{restoreMode==="merge"?"Merge keeps current records and uses the newer version when IDs match.":"Replace removes current properties after validation. A local safety recovery point is created first."}</p>
        {impact&&restoreMode==="merge"&&<div className="ps-set-impact"><p><strong>Merge preview</strong></p><p>Current {impact.currentCount} · Backup {impact.backupCount}</p><p>Add {impact.addCount} · Update {impact.updateCount} · Keep newer current {impact.unchangedCount}</p><p className="ps-set-ok">Expected after merge: {impact.finalMergeCount} properties</p>{impact.addCount>0&&<p>A higher total is expected: the backup holds {impact.addCount} record{impact.addCount===1?"":"s"} with a different internal ID. Restore does not create duplicates.</p>}</div>}
        {impact&&restoreMode==="replace"&&<div className="ps-set-impact is-danger"><p><strong>Replace preview</strong></p><p>Current {impact.currentCount} properties will be replaced by {impact.backupCount} backup properties.</p></div>}
        <button onClick={restore} className="ps-btn-primary">Confirm restore</button>
      </div>}
    </Group>

    <Group title="Export" note="Use Full Backup for complete recovery. CSV is for analysis and does not contain photo files.">
      <Row label="Export all as JSON" onClick={()=>exportAllJson(properties)} />
      <Row label={`Export all as CSV${plan!=="PRO"?" · Pro":""}`} onClick={()=>plan==="PRO"?exportAllCsv(properties):setMessage("Portfolio CSV is available on Plot Scout Pro. Full Backup remains available on every plan.")} />
    </Group>

    <Group title="Delete">
      {!confirmClear
        ? <Row label="Delete all saved properties" tone="danger" onClick={()=>setConfirmClear(true)} />
        : <div className="ps-set-embed ps-fade ps-set-confirm">
            <p>This removes all {properties.length} properties and their photos. Create a full backup first if you may need them later.</p>
            <div><button onClick={clearAll} className="ps-set-del">Yes, delete everything</button><button onClick={()=>setConfirmClear(false)} className="ps-btn-secondary">Cancel</button></div>
          </div>}
    </Group>

    <p className="ps-set-foot">Map data is an indicator only. Ownership, title, zoning, NA status, legal access and permissions must be independently verified.</p>
  </div>;
}

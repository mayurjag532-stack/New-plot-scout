import { openDB, IDBPDatabase } from "idb";
import { PropertyRecord, PropertyPhoto } from "./types";
import { OpportunityLead, normalizeOpportunityLead } from "./leads";

const DB_NAME = "land-scout-pro";
export const DB_VERSION = 3;
const PROPERTY_STORE = "properties";
const PHOTO_STORE = "photos";
const META_STORE = "meta";
const RECOVERY_STORE = "recovery";
const LEAD_STORE = "opportunity_leads";
const LS_KEY = "land-scout-pro:properties";
const MIGRATION_KEY = "migration:v2";
const LAST_BACKUP_KEY = "lastBackupAt";
const MAX_RECOVERY = 20;
const RECOVERY_MIN_INTERVAL_MS = 5 * 60 * 1000;

interface StoredPhoto { id: string; propertyId: string; category: PropertyPhoto["category"]; blob: Blob; addedAt: number; caption?: string; }
interface RecoveryPoint { id: string; propertyId: string; createdAt: number; property: PropertyRecord; reason: string; }
export interface StorageInfo { usage: number | null; quota: number | null; persisted: boolean | null; propertyCount: number; photoCount: number; lastBackupAt: number | null; recoveryCount: number; latestRecoveryAt: number | null; }
export interface BackupPreview { createdAt: number; propertyCount: number; photoCount: number; formatVersion: number; app: string; }
export interface RestoreImpact { currentCount: number; backupCount: number; addCount: number; updateCount: number; unchangedCount: number; finalMergeCount: number; }
interface BackupEnvelope { app: "Plot Scout"; formatVersion: 1; createdAt: number; properties: PropertyRecord[]; checksum: string; }

let dbPromise: Promise<IDBPDatabase> | null = null;
let migrationPromise: Promise<void> | null = null;

function emitStorageError(message: string, error?: unknown) {
  console.error(message, error);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("plot-scout-storage-error", { detail: { message } }));
}

function readLocalStorage(): PropertyRecord[] {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) as PropertyRecord[] : []; } catch { return []; }
}
function writeLocalStorage(all: PropertyRecord[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch { /* legacy safety mirror is best-effort */ }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] || "application/octet-stream";
  const binary = atob(body || "");
  const bytes = new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onerror=()=>reject(r.error); r.onload=()=>resolve(String(r.result)); r.readAsDataURL(blob); });
}
function stripPhotos(p: PropertyRecord): PropertyRecord { return { ...p, photos: [] }; }

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(PROPERTY_STORE)) {
          const s = db.createObjectStore(PROPERTY_STORE, { keyPath: "id" }); s.createIndex("updatedAt", "updatedAt");
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(PHOTO_STORE)) { const s=db.createObjectStore(PHOTO_STORE,{keyPath:"id"}); s.createIndex("propertyId","propertyId"); }
          if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
          if (!db.objectStoreNames.contains(RECOVERY_STORE)) { const s=db.createObjectStore(RECOVERY_STORE,{keyPath:"id"}); s.createIndex("createdAt","createdAt"); s.createIndex("propertyId","propertyId"); }
        }
        if (oldVersion < 3 && !db.objectStoreNames.contains(LEAD_STORE)) {
          const s = db.createObjectStore(LEAD_STORE, { keyPath: "id" });
          s.createIndex("updatedAt", "updatedAt");
          s.createIndex("status", "status");
        }
      },
      blocked() { emitStorageError("A Plot Scout database upgrade is blocked by another open tab. Close other Plot Scout tabs and reopen the app."); }
    });
  }
  const db = await dbPromise;
  if (!migrationPromise) migrationPromise = ensureV2Migration(db).catch((error) => { migrationPromise = null; throw error; });
  await migrationPromise;
  return db;
}

async function ensureV2Migration(db: IDBPDatabase) {
  if (await db.get(META_STORE, MIGRATION_KEY) === "complete") return;
  try {
    const idbRecords = (await db.getAll(PROPERTY_STORE)) as PropertyRecord[];
    const legacy = readLocalStorage();
    const byId = new Map<string, PropertyRecord>();
    for (const p of [...legacy, ...idbRecords]) {
      const current = byId.get(p.id);
      if (!current || (p.updatedAt || 0) >= (current.updatedAt || 0)) byId.set(p.id, p);
    }
    const tx = db.transaction([PROPERTY_STORE, PHOTO_STORE, META_STORE], "readwrite");
    for (const p of byId.values()) {
      for (const photo of p.photos || []) {
        if (photo.dataUrl) await tx.objectStore(PHOTO_STORE).put({ id: photo.id, propertyId: p.id, category: photo.category, blob: dataUrlToBlob(photo.dataUrl), addedAt: photo.addedAt, caption: photo.caption } as StoredPhoto);
      }
      await tx.objectStore(PROPERTY_STORE).put(stripPhotos(p));
    }
    await tx.objectStore(META_STORE).put("complete", MIGRATION_KEY);
    await tx.done;
    // Keep legacy mirror as a safety copy; do not delete it during v2 migration.
  } catch (e) { emitStorageError("Saved-data upgrade could not be completed. Your legacy copy was retained.", e); throw e; }
}

async function hydrate(db: IDBPDatabase, p: PropertyRecord): Promise<PropertyRecord> {
  const stored = await db.getAllFromIndex(PHOTO_STORE, "propertyId", p.id) as StoredPhoto[];
  if (!stored.length && p.photos?.length) return p; // defensive legacy compatibility
  const photos: PropertyPhoto[] = [];
  for (const x of stored) photos.push({ id:x.id, category:x.category, dataUrl:await blobToDataUrl(x.blob), addedAt:x.addedAt, caption:x.caption });
  photos.sort((a,b)=>a.addedAt-b.addedAt);
  return { ...p, photos };
}

async function createRecoveryPoint(db: IDBPDatabase, p: PropertyRecord, reason: string, force = false) {
  if (!force && reason === "before edit") {
    const recent = await db.getAllFromIndex(RECOVERY_STORE, "propertyId", p.id) as RecoveryPoint[];
    const latest = recent.reduce((m, x) => Math.max(m, x.createdAt), 0);
    if (Date.now() - latest < RECOVERY_MIN_INTERVAL_MS) return;
  }
  const point: RecoveryPoint = { id:`rec_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, propertyId:p.id, createdAt:Date.now(), property:stripPhotos(p), reason };
  await db.put(RECOVERY_STORE, point);
  const all = await db.getAllFromIndex(RECOVERY_STORE, "createdAt") as RecoveryPoint[];
  if (all.length > MAX_RECOVERY) for (const old of all.slice(0, all.length-MAX_RECOVERY)) await db.delete(RECOVERY_STORE, old.id);
}

export async function saveProperty(property: PropertyRecord): Promise<void> {
  const updated: PropertyRecord = { ...property, updatedAt: Date.now() };
  try {
    const db = await getDb();
    const previous = await db.get(PROPERTY_STORE, updated.id) as PropertyRecord | undefined;
    if (previous) await createRecoveryPoint(db, previous, "before edit");
    const tx = db.transaction([PROPERTY_STORE, PHOTO_STORE], "readwrite");
    await tx.objectStore(PROPERTY_STORE).put(stripPhotos(updated));
    const photoStore = tx.objectStore(PHOTO_STORE);
    const oldPhotos = await photoStore.index("propertyId").getAll(updated.id) as StoredPhoto[];
    const incomingIds = new Set((updated.photos || []).map(x=>x.id));
    for (const old of oldPhotos) if (!incomingIds.has(old.id)) await photoStore.delete(old.id);
    for (const photo of updated.photos || []) if (photo.dataUrl) await photoStore.put({ id:photo.id, propertyId:updated.id, category:photo.category, blob:dataUrlToBlob(photo.dataUrl), addedAt:photo.addedAt, caption:photo.caption } as StoredPhoto);
    await tx.done;
    // The pre-v2 localStorage copy is intentionally left untouched. Writing full photo data URLs
    // here would duplicate every image and can exhaust localStorage, slowing or breaking saves.
  } catch (e) { emitStorageError("This property could not be saved. Please create a backup before closing the app.", e); throw e; }
}

export async function getPropertySummaries(): Promise<PropertyRecord[]> {
  try {
    const db = await getDb();
    const rows = await db.getAll(PROPERTY_STORE) as PropertyRecord[];
    /* Summaries stay light (no image data) but carry photo metadata, so list scores,
       completeness and counts agree with the dossier, which scores the same photos. */
    const stored = await db.getAll(PHOTO_STORE) as StoredPhoto[];
    const byProperty = new Map<string, PropertyPhoto[]>();
    for (const x of stored) {
      const list = byProperty.get(x.propertyId) ?? [];
      list.push({ id:x.id, category:x.category, dataUrl:"", addedAt:x.addedAt, caption:x.caption });
      byProperty.set(x.propertyId, list);
    }
    return rows.map((p)=>({ ...p, photos: byProperty.get(p.id) ?? [] })).sort((a,b)=>b.updatedAt-a.updatedAt);
  } catch (e) {
    emitStorageError("IndexedDB could not be read. Showing the retained legacy copy if available.", e);
    return readLocalStorage().map(stripPhotos).sort((a,b)=>b.updatedAt-a.updatedAt);
  }
}

export async function getAllProperties(): Promise<PropertyRecord[]> {
  try { const db=await getDb(); const rows=await db.getAll(PROPERTY_STORE) as PropertyRecord[]; return (await Promise.all(rows.map(p=>hydrate(db,p)))).sort((a,b)=>b.updatedAt-a.updatedAt); }
  catch(e) { emitStorageError("IndexedDB could not be read. Showing the retained legacy copy if available.",e); return readLocalStorage().sort((a,b)=>b.updatedAt-a.updatedAt); }
}
export async function getProperty(id:string):Promise<PropertyRecord|undefined>{ try{const db=await getDb(); const p=await db.get(PROPERTY_STORE,id) as PropertyRecord|undefined; return p?hydrate(db,p):readLocalStorage().find(x=>x.id===id);}catch(e){emitStorageError("Saved property could not be read.",e);return readLocalStorage().find(x=>x.id===id);} }

export async function deleteProperty(id:string):Promise<void>{
  try{const db=await getDb(); const p=await getProperty(id); if(p) await createRecoveryPoint(db,p,"before delete", true); const tx=db.transaction([PROPERTY_STORE,PHOTO_STORE],"readwrite"); await tx.objectStore(PROPERTY_STORE).delete(id); const photos=await tx.objectStore(PHOTO_STORE).index("propertyId").getAll(id) as StoredPhoto[]; for(const x of photos) await tx.objectStore(PHOTO_STORE).delete(x.id); await tx.done; const legacy=readLocalStorage().filter(x=>x.id!==id); writeLocalStorage(legacy);}catch(e){emitStorageError("Property deletion failed; no successful deletion was reported.",e);throw e;}
}
export async function deleteAllProperties():Promise<void>{ for(const p of await getAllProperties()) await deleteProperty(p.id); }

async function sha256(text:string){ const bytes=new TextEncoder().encode(text); const digest=await crypto.subtle.digest("SHA-256",bytes); return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join(""); }
function downloadBlob(filename:string, blob:Blob){const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}

export async function createFullBackup():Promise<BackupPreview>{
  const properties=await getAllProperties(); const createdAt=Date.now(); const payload=JSON.stringify({app:"Plot Scout",formatVersion:1,createdAt,properties}); const checksum=await sha256(payload); const envelope:BackupEnvelope={...(JSON.parse(payload)),checksum};
  downloadBlob(`plot-scout-backup-${new Date(createdAt).toISOString().slice(0,10)}.plotscout`,new Blob([JSON.stringify(envelope)],{type:"application/json"}));
  const db=await getDb(); await db.put(META_STORE,createdAt,LAST_BACKUP_KEY);
  return {createdAt,propertyCount:properties.length,photoCount:properties.reduce((n,p)=>n+p.photos.length,0),formatVersion:1,app:"Plot Scout"};
}

async function parseBackup(file:File):Promise<{envelope:BackupEnvelope;preview:BackupPreview}>{
  let x:any; try{x=JSON.parse(await file.text());}catch{throw new Error("This is not a valid Plot Scout backup file.");}
  if(x?.app!=="Plot Scout"||x?.formatVersion!==1||!Array.isArray(x?.properties)||typeof x?.createdAt!=="number"||typeof x?.checksum!=="string") throw new Error("Unsupported or incomplete Plot Scout backup.");
  const payload=JSON.stringify({app:x.app,formatVersion:x.formatVersion,createdAt:x.createdAt,properties:x.properties}); if(await sha256(payload)!==x.checksum) throw new Error("Backup integrity check failed. The file may be damaged or modified.");
  for(const p of x.properties) if(!p?.id||typeof p.updatedAt!=="number"||!Array.isArray(p.photos)) throw new Error("Backup contains an invalid property record.");
  return {envelope:x,preview:{createdAt:x.createdAt,propertyCount:x.properties.length,photoCount:x.properties.reduce((n:number,p:PropertyRecord)=>n+p.photos.length,0),formatVersion:x.formatVersion,app:x.app}};
}
export async function previewBackup(file:File):Promise<BackupPreview>{return (await parseBackup(file)).preview;}
export async function previewRestoreImpact(file:File):Promise<RestoreImpact>{
  const {envelope}=await parseBackup(file);
  const current=await getAllProperties();
  const byId=new Map(current.map(p=>[p.id,p]));
  let addCount=0, updateCount=0, unchangedCount=0;
  for(const incoming of envelope.properties){
    const old=byId.get(incoming.id);
    if(!old) addCount++;
    else if(incoming.updatedAt>=old.updatedAt) updateCount++;
    else unchangedCount++;
  }
  return {currentCount:current.length,backupCount:envelope.properties.length,addCount,updateCount,unchangedCount,finalMergeCount:current.length+addCount};
}
export async function restoreBackup(file:File, mode:"merge"|"replace"):Promise<{restored:number}>{
  const {envelope}=await parseBackup(file); const current=await getAllProperties(); const db=await getDb();
  // Safety snapshot metadata + records (without duplicating photo blobs).
  for(const p of current) await createRecoveryPoint(db,p,"before full restore", true);
  try{
    if(mode==="replace") { const tx=db.transaction([PROPERTY_STORE,PHOTO_STORE],"readwrite"); await tx.objectStore(PROPERTY_STORE).clear(); await tx.objectStore(PHOTO_STORE).clear(); await tx.done; }
    const existing=new Map((mode==="merge"?current:[]).map(p=>[p.id,p]));
    for(const incoming of envelope.properties){const old=existing.get(incoming.id); if(!old||incoming.updatedAt>=old.updatedAt) await saveProperty(incoming);}
    const after=await getAllProperties(); if(envelope.properties.length>0 && after.length===0) throw new Error("Restore verification failed.");
    return {restored:envelope.properties.length};
  }catch(e){
    // Best-effort rollback to the known-good in-memory pre-restore set.
    try{const tx=db.transaction([PROPERTY_STORE,PHOTO_STORE],"readwrite");await tx.objectStore(PROPERTY_STORE).clear();await tx.objectStore(PHOTO_STORE).clear();await tx.done;for(const p of current)await saveProperty(p);}catch(rollback){emitStorageError("Restore failed and automatic rollback also failed. Retained legacy data may still be available.",rollback);}
    throw e;
  }
}

export async function getStorageInfo():Promise<StorageInfo>{
  const db=await getDb(); const [propertyCount,photoCount,recoveryCount,lastBackupAt,recoveryRows]=await Promise.all([db.count(PROPERTY_STORE),db.count(PHOTO_STORE),db.count(RECOVERY_STORE),db.get(META_STORE,LAST_BACKUP_KEY),db.getAllFromIndex(RECOVERY_STORE,"createdAt") as Promise<RecoveryPoint[]>]);
  const latestRecoveryAt = recoveryRows.length ? recoveryRows[recoveryRows.length - 1].createdAt : null;
  let usage:null|number=null,quota:null|number=null,persisted:null|boolean=null;
  try{if(navigator.storage?.estimate){const e=await navigator.storage.estimate();usage=e.usage??null;quota=e.quota??null;} if(navigator.storage?.persisted) persisted=await navigator.storage.persisted();}catch{/* unsupported */}
  return {usage,quota,persisted,propertyCount,photoCount,lastBackupAt:typeof lastBackupAt==="number"?lastBackupAt:null,recoveryCount,latestRecoveryAt};
}
export async function requestPersistentStorage():Promise<boolean|null>{try{return navigator.storage?.persist?await navigator.storage.persist():null;}catch{return null;}}


export async function saveOpportunityLead(lead: OpportunityLead): Promise<void> {
  const db = await getDb();
  await db.put(LEAD_STORE, { ...lead, updatedAt: Date.now() });
}
export async function getOpportunityLeads(): Promise<OpportunityLead[]> {
  const db = await getDb();
  const rows = await db.getAll(LEAD_STORE) as OpportunityLead[];
  return rows.map(normalizeOpportunityLead).sort((a,b)=>b.updatedAt-a.updatedAt);
}
export async function deleteOpportunityLead(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(LEAD_STORE, id);
}

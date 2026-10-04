import { lazy, Suspense, useEffect, useState } from "react";
import { PropertyRecord, newProperty } from "./types";
import { getPropertySummaries, getProperty, deleteProperty, getOpportunityLeads, saveOpportunityLead, deleteOpportunityLead } from "./db";
import { OpportunityLead, newSharedLead } from "./leads";
import OpportunityRadar from "./components/OpportunityRadar";
import PropertyList from "./components/PropertyList";
import { getPlan, PLAN_META, Plan, syncTrustedEntitlements } from "./entitlements";
import { BuyerProfile, getBuyerProfile } from "./personalization";
import { useOnline } from "./hooks";
import { getTheme, setTheme } from "./utils/theme";
const NewVisit = lazy(() => import("./components/NewVisit"));
const Settings = lazy(() => import("./components/Settings"));

type Tab = "new" | "list" | "leads" | "settings";

function Mark({ kind }: { kind: "new" | "list" | "leads" | "settings" }) {
  if (kind === "new") return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>;
  if (kind === "list") return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 9h7M8.5 13h7M8.5 17h5"/></svg>;
  if (kind === "leads") return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 18V8l8-4 8 4v10"/><path d="M7 18h10M9 14l3-3 3 3"/></svg>;
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6.2L14.7 4h-4L10.4 6.2a8 8 0 0 0-1.5.9l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.5.9l.3 2.2h4l.3-2.2a8 8 0 0 0 1.5-.9l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/></svg>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("list");
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [leads, setLeads] = useState<OpportunityLead[]>([]);
  const [activeProperty, setActiveProperty] = useState<PropertyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [plan,setPlanState]=useState<Plan>("PRO");
  const [storageError, setStorageError] = useState<string | null>(null);
  const [buyerProfile,setBuyerProfile]=useState<BuyerProfile>(()=>getBuyerProfile());
  const [theme, setThemeState] = useState<"light"|"dark">(()=>getTheme());
  const online = useOnline();

  async function refresh() { setProperties(await getPropertySummaries()); }
  async function refreshLeads() { setLeads(await getOpportunityLeads()); }
  useEffect(() => { Promise.all([refresh(), refreshLeads(), syncTrustedEntitlements()]).then(()=>setPlanState("PRO")).finally(() => setLoaded(true)); }, []);
  useEffect(()=>{const h=(e:Event)=>setBuyerProfile((e as CustomEvent).detail?.profile||getBuyerProfile());window.addEventListener("plot-scout-profile-change",h);return()=>window.removeEventListener("plot-scout-profile-change",h);},[]);
  useEffect(()=>{const h=(e:Event)=>setPlanState("PRO");window.addEventListener("plot-scout-plan-change",h);return()=>window.removeEventListener("plot-scout-plan-change",h);},[]);
  useEffect(() => {
    const h = (e: Event) => setStorageError((e as CustomEvent).detail?.message || "Local storage encountered a problem.");
    window.addEventListener("plot-scout-storage-error", h);
    return () => window.removeEventListener("plot-scout-storage-error", h);
  }, []);

  useEffect(() => {
    const onTheme = () => setThemeState(getTheme());
    window.addEventListener("plot-scout-theme-change", onTheme);
    return () => window.removeEventListener("plot-scout-theme-change", onTheme);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("share-target") !== "1") return;
    const input = { title: q.get("title") || "", text: q.get("text") || "", url: q.get("url") || "" };
    if (!input.title && !input.text && !input.url) return;
    (async () => {
      // Check IndexedDB directly (not React state, which may not have loaded yet) so
      // sharing the same link twice never creates a duplicate lead.
      const existing = await getOpportunityLeads();
      const lead = newSharedLead(input);
      const alreadyCaptured = lead.sourceUrl && existing.some((l) => l.sourceUrl === lead.sourceUrl);
      if (!alreadyCaptured) await saveOpportunityLead(lead);
      await refreshLeads();
      setTab("leads");
      history.replaceState({}, "", window.location.pathname);
    })();
  }, []);
  async function removeLead(id:string) { await deleteOpportunityLead(id); await refreshLeads(); }
  function startNewVisit() { setActiveProperty(newProperty(`Visit ${new Date().toLocaleDateString()}`)); setTab("new"); }
  async function openProperty(id: string) { const p = await getProperty(id); if (p) { setActiveProperty(p); setTab("new"); } }
  function backFromVisit() { setActiveProperty(null); refresh(); setTab("list"); }
  async function removeProperty(id:string) { await deleteProperty(id); await refresh(); }

  if (!loaded) return <div className="min-h-screen bg-field-bg text-field-text" role="status" aria-label="Loading your portfolio"><header className="px-5 pt-5 pb-2 max-w-xl mx-auto"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-field-accent flex items-center justify-center font-semibold text-field-bg">P</div><div className="space-y-2"><div className="skeleton h-2.5 w-32"/><div className="skeleton h-4 w-24"/></div></div></header><main className="px-4 md:px-8 pt-6 max-w-xl mx-auto"><div className="skeleton h-8 w-40"/><div className="skeleton h-14 w-56 mt-6"/><div className="skeleton h-3 w-44 mt-3"/><div className="skeleton rounded-3xl w-full mt-8" style={{ height: "46dvh" }}/><div className="skeleton h-12 w-full mt-4 rounded-2xl"/></main></div>;

  return <div className="min-h-screen bg-field-bg text-field-text">
    {!online && <div className="ps-offline" role="status"><i aria-hidden="true"/>Offline <span>· your plots, photos and notes are saved on this device</span></div>}
    {storageError && <div role="alert" className="ps-storage-err"><div><p className="font-display">Storage needs attention</p><small>{storageError}</small></div><button onClick={() => setStorageError(null)} aria-label="Dismiss storage warning">Dismiss</button></div>}
    {tab !== "new" && <header className="px-5 pt-5 pb-2 max-w-xl mx-auto"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl border border-field-line bg-field-card flex items-center justify-center text-field-accent font-semibold tracking-tight">P</div><div className="min-w-0 flex-1"><p className="text-[11px] uppercase tracking-[.18em] text-field-muted font-semibold">Private field intelligence</p><div className="flex items-center gap-2"><h1 className="font-display text-[21px] text-field-text">Plot Scout</h1><span className="text-[9px] uppercase tracking-[.12em] text-field-accent border border-field-accent/30 rounded-full px-2 py-0.5 font-semibold">{PLAN_META[plan].name}</span></div></div><button type="button" className="ps-map-float ps-theme-toggle" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} onClick={() => { const next = theme === "light" ? "dark" : "light"; setTheme(next); setThemeState(next); }}><span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span><span>{theme === "light" ? "Dark" : "Light"}</span></button>
      <nav className="hidden md:flex items-center gap-1 shrink-0">
        <button onClick={startNewVisit} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-field-muted hover:bg-field-card hover:text-field-text"><Mark kind="new"/>New visit</button>
        <button onClick={() => setTab("list")} aria-current={tab === "list" ? "page" : undefined} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium ${tab === "list" ? "bg-field-card text-field-accent" : "text-field-muted hover:bg-field-card hover:text-field-text"}`}><Mark kind="list"/>Properties</button>
        <button onClick={() => setTab("leads")} aria-current={tab === "leads" ? "page" : undefined} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium ${tab === "leads" ? "bg-field-card text-field-accent" : "text-field-muted hover:bg-field-card hover:text-field-text"}`}><Mark kind="leads"/>Radar</button>
        <button onClick={() => setTab("settings")} aria-current={tab === "settings" ? "page" : undefined} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium ${tab === "settings" ? "bg-field-card text-field-accent" : "text-field-muted hover:bg-field-card hover:text-field-text"}`}><Mark kind="settings"/>Settings</button>
      </nav>
    </div></header>}
    {tab === "new" && activeProperty && <Suspense fallback={<div className="px-4 py-8 max-w-xl mx-auto"><div className="skeleton h-32 w-full"/></div>}><NewVisit initial={activeProperty} onBack={backFromVisit} plan={plan} buyerProfile={buyerProfile} /></Suspense>}
    {tab === "list" && <div key="list" className="ps-tab-in"><PropertyList properties={properties} onOpen={openProperty} onNew={startNewVisit} plan={plan} onDelete={removeProperty} /></div>}
    {tab === "leads" && <div key="leads" className="ps-tab-in"><OpportunityRadar leads={leads} onDelete={removeLead} onDiscovered={async (lead)=>{await saveOpportunityLead(lead);await refreshLeads();}} onUpdate={async (lead)=>{await saveOpportunityLead(lead);await refreshLeads();}} /></div>}
    {tab === "settings" && <div key="settings" className="ps-tab-in"><Suspense fallback={<div className="px-4 py-8 max-w-xl mx-auto"><div className="skeleton h-32 w-full"/></div>}><Settings properties={properties} onDataChanged={refresh} buyerProfile={buyerProfile} /></Suspense></div>}
    {tab !== "new" && <nav className="fixed bottom-0 left-0 right-0 z-20 bg-field-card/95 backdrop-blur-xl border-t border-field-line safe-bottom md:hidden"><div className="max-w-xl mx-auto grid grid-cols-4 px-2">
      <button onClick={startNewVisit} className="py-2.5 flex flex-col items-center gap-1 text-field-muted"><Mark kind="new"/><span className="text-[11px] font-medium">New visit</span></button>
      <button onClick={() => setTab("list")} aria-current={tab === "list" ? "page" : undefined} className={`py-2.5 flex flex-col items-center gap-1 ${tab === "list" ? "text-field-accent" : "text-field-muted"}`}><Mark kind="list"/><span className="text-[11px] font-medium">Properties</span></button>
      <button onClick={() => setTab("leads")} aria-current={tab === "leads" ? "page" : undefined} className={`py-2.5 flex flex-col items-center gap-1 ${tab === "leads" ? "text-field-accent" : "text-field-muted"}`}><Mark kind="leads"/><span className="text-[11px] font-medium">Radar</span></button>
      <button onClick={() => setTab("settings")} aria-current={tab === "settings" ? "page" : undefined} className={`py-2.5 flex flex-col items-center gap-1 ${tab === "settings" ? "text-field-accent" : "text-field-muted"}`}><Mark kind="settings"/><span className="text-[11px] font-medium">Settings</span></button>
    </div></nav>}
  </div>;
}


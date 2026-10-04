import { useState } from "react";
import { MapContainer, Circle, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { ThemeTiles, plotIcon } from "./MapView";
import BasemapSwitcher from "./BasemapSwitcher";
import LeadInbox from "./LeadInbox";
import { OpportunityLead, newDiscoveryLead } from "../leads";

type Scope = { mode: "near_me" | "selected"; lat?: number; lon?: number; state: string; district: string; taluka: string; locality: string; radiusKm: number };
const endpoint = (import.meta.env.VITE_RADAR_DISCOVERY_URL || "/api/radar-discovery").trim();

function FitRadius({ lat, lon, km }: { lat: number; lon: number; km: number }) {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); map.fitBounds(L.latLng(lat, lon).toBounds(km * 2000).pad(0.15), { animate: false }); }, [map, lat, lon, km]);
  return null;
}
/** The scan area: the radius is the searched circle around the captured position — not a parcel or boundary. */
function ScanMap({ lat, lon, km, place }: { lat?: number; lon?: number; km: number; place: string }) {
  if (lat == null || lon == null) {
    return (
      <div className="ps-rad-map is-empty">
        <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M-10 ${30 + i * 32} C 90 ${10 + i * 32}, 170 ${60 + i * 32}, 270 ${28 + i * 32} S 380 ${40 + i * 32}, 420 ${24 + i * 32}`} fill="none" stroke="currentColor" strokeWidth=".8" />)}
          <circle cx="200" cy="110" r="64" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" />
        </svg>
        <p className="font-display">Choose where to scan</p>
        <small>Capture your position or name an area. The search radius appears here.</small>
      </div>
    );
  }
  return (
    <div className="ps-rad-map">
      <MapContainer center={[lat, lon]} zoom={11} zoomControl={false} scrollWheelZoom={false} attributionControl style={{ height: "100%", width: "100%" }}>
        <ThemeTiles />
        <FitRadius lat={lat} lon={lon} km={km} />
        <Circle center={[lat, lon]} radius={km * 1000} pathOptions={{ color: "#B9955A", weight: 1.5, dashArray: "5 6", fillColor: "#B9955A", fillOpacity: 0.08 }} />
        <Marker position={[lat, lon]} icon={plotIcon} keyboard={false} />
      </MapContainer>
      <div className="ps-rad-chip"><strong className="tabular-nums">{km} km</strong> scan radius{place ? ` · ${place}` : ""}</div>
      <div className="absolute right-2.5 bottom-2.5 z-[500]"><BasemapSwitcher /></div>
    </div>
  );
}

function gpsErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return "Location permission denied. Enable location access for this site in your browser settings, or use \"Choose area\" below instead — Radar works fully without GPS.";
  if (err.code === err.TIMEOUT) return "GPS timed out. Try again outdoors/near a window, or use \"Choose area\" below instead.";
  return "Location unavailable right now. Try again, or use \"Choose area\" below instead.";
}

export default function OpportunityRadar({ leads, onDelete, onDiscovered, onDeleteSelected, onDeleteAll, onUpdate }: { leads: OpportunityLead[]; onDelete: (id: string) => void; onDiscovered: (lead: OpportunityLead) => Promise<void>; onDeleteSelected?: (ids: string[]) => Promise<void>; onDeleteAll?: () => Promise<void>; onUpdate?: (lead: OpportunityLead) => Promise<void> }) {
  const [scope, setScope] = useState<Scope>({ mode: "near_me", state: "", district: "", taluka: "", locality: "", radiusKm: 15 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  function locate() {
    if (!("geolocation" in navigator)) { setMsg("This browser does not support GPS. Use \"Choose area\" below instead."); return; }
    setBusy(true);
    setMsg("Getting location\u2026");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude, lon = p.coords.longitude;
        let patch: Partial<Scope> = { lat, lon };
        let resolved = true;
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;
          const r = await fetch(url, { headers: { Accept: "application/json", "Accept-Language": "en" } });
          if (!r.ok) throw new Error(`Geocoder ${r.status}`);
          const d = await r.json();
          const a = d?.address || {};
          patch = { ...patch, state: a.state || "", district: a.state_district || a.county || a.district || "", taluka: a.subdistrict || a.taluka || a.county || "", locality: a.village || a.town || a.city || a.suburb || a.hamlet || a.neighbourhood || a.city_district || "" };
          resolved = Boolean(patch.state || patch.district || patch.taluka || patch.locality);
        } catch {
          resolved = false;
        }
        setScope((s) => ({ ...s, ...patch, mode: "near_me" }));
        setMsg(resolved ? "Location ready. Discovery will use this area, not a hard-coded city." : "GPS captured, but area names could not be resolved (geocoder unavailable). Coordinates were kept safely — nothing was guessed. Tap \"Refresh current location\" to retry, or use \"Choose area\" below.");
        setBusy(false);
      },
      (err) => { setMsg(gpsErrorMessage(err)); setBusy(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  async function discover() {
    if (scope.mode === "near_me" && !scope.lat) { setMsg("Capture current location first, or switch to \"Choose area\"."); return; }
    if (scope.mode === "selected" && !scope.state.trim()) { setMsg("Enter at least a State for selected-area search."); return; }
    if (!endpoint) { setMsg("Discovery engine is not connected yet. Scope is ready; no fake leads were generated."); return; }
    setBusy(true);
    setMsg("Searching public opportunity sources...");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...scope, country: "IN" }) });
      if (!r.ok) throw new Error(`Discovery service ${r.status}`);
      const d = await r.json();
      const candidates = Array.isArray(d?.candidates) ? d.candidates : [];
      const actionable = candidates
        .filter((candidate: any) => candidate?.saleIntent === true || candidate?.evidenceClass === "sale_signal")
        .sort((a: any, b: any) => (Number(a?.distanceKm) || 999999) - (Number(b?.distanceKm) || 999999));
      let added = 0;
      for (const candidate of actionable) {
        const url = String(candidate?.sourceUrl || "").trim();
        const externalId = String(candidate?.externalId || "").trim();
        const duplicate = leads.some((l) => l.sourceUrl === url || l.evidence.some((e) => e.kind === "verification_snapshot" && externalId && e.value.includes(`"externalId":"${externalId}"`)));
        if (duplicate) continue;
        await onDiscovered(newDiscoveryLead(candidate));
        added++;
      }
      setMsg(actionable.length > 0
        ? `${candidates.length} signals scanned. ${actionable.length} sale signals found. ${added} new leads captured. ${candidates.length - actionable.length} context-only signals filtered out.`
        : "Result not found — no verified sale signals were returned for this search area. Nothing was invented or added.");
    } catch (e: any) {
      const status = String(e?.message || "");
      setMsg(status.includes("404") || status.includes("Failed to fetch")
        ? "Result not found — the Radar discovery service is not connected for this deployment. No fake leads were generated."
        : `Result not found — discovery could not return verified sale signals right now. ${status}`);
    } finally {
      setBusy(false);
    }
  }

  const scopeSummary = scope.mode === "near_me"
    ? (scope.lat ? ([scope.locality, scope.taluka, scope.district, scope.state].filter(Boolean).join(" · ") || "GPS position captured") : "No position yet")
    : (scope.state.trim() ? [scope.locality, scope.taluka, scope.district, scope.state].filter(Boolean).join(" · ") : "No area chosen");

  const place = [scope.locality, scope.taluka, scope.district].filter(Boolean)[0] || "";
  return (
    <main className="ps-rad">
      <header className="ps-rise">
        <p className="ps-kicker">Opportunity Radar · India</p>
        <h2 className="font-display">Find land opportunities</h2>
      </header>

      <div className="ps-rad-grid">
        <ScanMap lat={scope.mode === "near_me" ? scope.lat : undefined} lon={scope.mode === "near_me" ? scope.lon : undefined} km={scope.radiusKm} place={place} />

        <div className="ps-rad-panel">
          <div className="ps-metric">
            <p className="ps-metric-label">Leads captured</p>
            <p className="ps-metric-value font-display tabular-nums">{leads.length}</p>
            <p className="ps-metric-context">{scope.lat || scope.state.trim() ? `Scanning ${scopeSummary}` : "Plot Scout searches, verifies and filters for you."}</p>
          </div>

          <div className="ps-seg ps-rad-seg" role="tablist" aria-label="Search scope">
            <button role="tab" aria-selected={scope.mode === "near_me"} onClick={() => setScope((s) => ({ ...s, mode: "near_me" }))}>Near me</button>
            <button role="tab" aria-selected={scope.mode === "selected"} onClick={() => setScope((s) => ({ ...s, mode: "selected" }))}>Choose area</button>
          </div>

          {scope.mode === "near_me" ? (
            <div>
              <button disabled={busy} onClick={locate} className="ps-btn-secondary w-full">{scope.lat ? "Refresh current location" : "Use current location"}</button>
              {scope.lat && <p className="ps-rad-place">{[scope.locality, scope.taluka, scope.district, scope.state].filter(Boolean).join(" · ") || `${scope.lat.toFixed(5)}, ${scope.lon?.toFixed(5)}`}</p>}
            </div>
          ) : (
            <div className="ps-rad-fields">
              {(["state", "district", "taluka", "locality"] as const).map((k) => (
                <label key={k} className="ps-label">
                  {k === "state" ? "State *" : k === "district" ? "District" : k === "taluka" ? "Taluka / Tehsil" : "Village / Locality"}
                  <input value={scope[k]} onChange={(e) => setScope((s) => ({ ...s, [k]: e.target.value }))} />
                </label>
              ))}
            </div>
          )}

          <label className="ps-rad-radius">
            <span><span className="ps-label">Search radius</span><strong className="font-display tabular-nums">{scope.radiusKm} km</strong></span>
            <input type="range" min="2" max="100" value={scope.radiusKm} onChange={(e) => setScope((s) => ({ ...s, radiusKm: Number(e.target.value) }))} aria-label="Search radius in kilometres" />
          </label>

          <button disabled={busy} onClick={discover} className="ps-btn-primary w-full">{busy ? "Scanning…" : "Find opportunities"}</button>
          {msg && <p role="status" className="ps-rad-msg">{msg}</p>}
          <p className="ps-rad-rule"><strong>Evidence rule.</strong> Search context is never treated as property location. No verified location — no opportunity score.</p>
        </div>
      </div>

      {leads.length > 0 && (
        <section className="ps-rad-manage" aria-label="Manage leads">
          <button type="button" onClick={() => setSelected(selected.length === leads.length ? [] : leads.map((l) => l.id))}>{selected.length === leads.length ? "Clear selection" : "Select all"}</button>
          <button type="button" disabled={!selected.length} onClick={async () => { if (!confirm(`Delete ${selected.length} selected leads?`)) return; if (onDeleteSelected) await onDeleteSelected(selected); else for (const id of selected) await Promise.resolve(onDelete(id)); setSelected([]); }}>Delete selected ({selected.length})</button>
          <button type="button" className="is-danger" onClick={async () => { if (!confirm(`Delete all ${leads.length} leads? This cannot be undone.`)) return; if (onDeleteAll) await onDeleteAll(); else for (const lead of leads) await Promise.resolve(onDelete(lead.id)); setSelected([]); }}>Delete all ({leads.length})</button>
          <div className="ps-rad-pick">{leads.map((l) => <label key={l.id}><input type="checkbox" checked={selected.includes(l.id)} onChange={() => setSelected((x) => x.includes(l.id) ? x.filter((id) => id !== l.id) : [...x, l.id])} /><span className="truncate">{l.sharedTitle || "Untitled lead"}</span></label>)}</div>
        </section>
      )}

      <LeadInbox leads={leads} onDelete={onDelete} onUpdate={onUpdate} embedded />
    </main>
  );
}

import { useEffect, useRef, useState } from "react";
import { PropertyRecord } from "../types";
import { googleMapsPointUrl } from "../utils/geo";
import { exportPropertyJson, exportPropertyCsv, printPropertyReport } from "../utils/export";
import { canUse, getPlan } from "../entitlements";

/**
 * Floating dossier header. Over the aerial hero it is just a back button and
 * actions in glass; once the sheet scrolls up it condenses into a bar that
 * carries the property name — the spatial context is never lost.
 */
export default function PropertyHeader({
  property,
  condensed,
  scrolled,
  onBack
}: {
  property: PropertyRecord;
  condensed: boolean;
  scrolled: boolean;
  onBack: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [menuOpen]);

  async function share() {
    const loc = property.location;
    const text = `${property.name}${loc ? ` - ${googleMapsPointUrl(loc.lat, loc.lng)}` : ""}`;
    if (navigator.share) {
      try { await navigator.share({ title: property.name, text }); } catch { /* user cancelled */ }
    } else if (loc) {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard (share not supported on this browser).");
    }
  }

  function runReport() {
    setMenuOpen(false);
    if (canUse(getPlan(), "professional_report")) printPropertyReport(property);
    else alert("Before-Token Decision Reports are available on Plot Scout Pro.");
  }

  return (
    <div className={`ps-dhead ${condensed ? "is-condensed" : ""} ${scrolled ? "is-scrolled" : ""}`}>
      <button onClick={onBack} className="ps-map-float ps-dhead-btn" aria-label="Back to portfolio">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18 9 12l6-6" /></svg>
      </button>
      <p className="ps-dhead-title font-display" aria-hidden={!condensed}>{property.name || "Untitled property"}</p>
      <div className="ps-dhead-actions">
        {property.location && (
          <a href={googleMapsPointUrl(property.location.lat, property.location.lng)} target="_blank" rel="noreferrer" className="ps-map-float ps-dhead-pill">
            Maps
          </a>
        )}
        <button onClick={runReport} className="ps-map-float ps-dhead-pill ps-dhead-pill-strong">Report</button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="ps-map-float ps-dhead-btn"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
          </button>
          {menuOpen && (
            <div className="ps-menu ps-pop" role="menu">
              {property.location && (
                <>
                  <button role="menuitem" onClick={() => { navigator.clipboard.writeText(`${property.location!.lat},${property.location!.lng}`); setMenuOpen(false); }}>Copy coordinates</button>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); void share(); }}>Share</button>
                  <hr />
                </>
              )}
              <button role="menuitem" onClick={() => { exportPropertyJson(property); setMenuOpen(false); }}>Export JSON</button>
              <button role="menuitem" onClick={() => { exportPropertyCsv(property); setMenuOpen(false); }}>Export CSV</button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); runReport(); }}>Download PDF report</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

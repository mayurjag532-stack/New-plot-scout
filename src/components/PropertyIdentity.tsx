import { Fragment } from "react";
import { DataProvenance, PropertyIdentity, emptyPropertyIdentity } from "../types";
import { StatusTag, Tone } from "./ui/StatusTag";

const provenanceLabels: Record<DataProvenance, string> = {
  VERIFIED: "Verified",
  USER_ENTERED: "User entered",
  MAP_DERIVED: "Map derived / estimated",
  NEEDS_VERIFICATION: "Needs verification"
};
const provenanceTone: Record<DataProvenance, Tone> = {
  VERIFIED: "good",
  USER_ENTERED: "neutral",
  MAP_DERIVED: "warn",
  NEEDS_VERIFICATION: "bad"
};

const PRIMARY_FIELDS: Array<[keyof PropertyIdentity, string, string]> = [
  ["district", "District", "e.g. Pune"], ["taluka", "Taluka", "e.g. Haveli"], ["village", "Village", "Revenue village"],
  ["gatNo", "Gat No.", "As shown on record"], ["surveyNo", "Survey No.", "If applicable"], ["hissaNo", "Hissa No.", "If applicable"],
  ["plotNo", "Plot No.", "Layout/plot reference"]
];
const SECONDARY_FIELDS: Array<[keyof PropertyIdentity, string, string]> = [
  ["ownerName", "Owner name", "As told / documented"], ["brokerName", "Broker / contact person", "Optional"],
  ["contact", "Contact", "Optional"], ["sourceReference", "Source / reference", "Document, owner, broker, etc."]
];

export default function PropertyIdentityPanel({ identity, onChange }: { identity?: PropertyIdentity; onChange: (v: PropertyIdentity) => void }) {
  const value = identity ?? emptyPropertyIdentity();
  const set = (key: keyof PropertyIdentity, v: string) => onChange({ ...value, [key]: v });
  const filledSecondary = SECONDARY_FIELDS.filter(([key]) => String(value[key] ?? "").trim()).length;

  return (
    <section className="bg-field-card border border-field-line rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-field-text font-semibold text-[15px] tracking-tight">Property Identity</h3>
          <p className="text-field-muted text-sm mt-1">Revenue identifiers and who supplied them. These fields do not establish legal ownership.</p>
        </div>
        
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="ps-label">State</label><input value={value.state} onChange={(e) => set("state", e.target.value)} className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm" /></div>
        {PRIMARY_FIELDS.map(([key, label, placeholder]) => (
          <div key={key}><label className="ps-label">{label}</label><input value={String(value[key] ?? "")} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm" /></div>
        ))}
      </div>

      <details className="mt-3 border-t border-field-line pt-3">
        <summary className="text-field-text text-sm font-semibold cursor-pointer flex items-center gap-2">
          Owner, broker & source
          {filledSecondary > 0 && <span className="text-field-muted text-[10px] font-normal border border-field-line rounded-full px-2 py-0.5">{filledSecondary}/{SECONDARY_FIELDS.length} added</span>}
        </summary>
        <div className="grid grid-cols-2 gap-3 mt-3">
          {SECONDARY_FIELDS.map(([key, label, placeholder]) => (
            <div key={key}><label className="ps-label">{label}</label><input value={String(value[key] ?? "")} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm" /></div>
          ))}
        </div>
      </details>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-field-muted">Source / verification status</label>
          <StatusTag tone={provenanceTone[value.provenance]} label={provenanceLabels[value.provenance]} />
        </div>
        <select value={value.provenance} onChange={(e) => onChange({ ...value, provenance: e.target.value as DataProvenance })} className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm">
          {Object.entries(provenanceLabels).filter(([k]) => k !== "VERIFIED" || value.provenance === "VERIFIED").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div className="ps-callout">
        <p className="text-xs text-field-muted"><strong className="text-field-text">Verification rule:</strong> GPS/map position is indicative only. Gat/Survey/Hissa, ownership, area, legal access, zoning and NA status require authoritative record/professional verification.</p>
      </div>
    </section>
  );
}

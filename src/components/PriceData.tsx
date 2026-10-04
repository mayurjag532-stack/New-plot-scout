import { PriceData } from "../types";
import { economics, GUNTHA_TO_SQFT } from "../utils/economics";

function NumField({ label, value, onChange, suffix }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void; suffix?: string; }) {
  return <div><label className="ps-label">{label}</label><div className="flex items-center gap-2"><input type="number" inputMode="decimal" min="0" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value)))} className="w-full bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm" />{suffix && <span className="text-field-muted text-xs shrink-0">{suffix}</span>}</div></div>;
}
const money=(n:number)=>`₹${Math.round(n).toLocaleString("en-IN")}`;
export default function PriceDataPanel({ price, onChange }: { price: PriceData; onChange: (price: PriceData) => void; }) {
  const set=<K extends keyof PriceData>(key:K,value:PriceData[K])=>onChange({...price,[key]:value});
  const e=economics(price);
  return <div className="bg-field-card border border-field-line rounded-xl p-4">
    <div className="flex items-start justify-between gap-3 mb-3"><div><h3 className="text-field-text font-semibold text-[15px] tracking-tight">Land Economics</h3><p className="text-field-muted text-xs mt-0.5">Comparable unit economics — not a valuation</p></div></div>
    <div className="grid grid-cols-2 gap-3">
      <p className="ps-group col-span-2">Price</p>
      <NumField label="Asking price (₹)" value={price.askingPrice} onChange={v=>set("askingPrice",v)}/><NumField label="Quoted price (₹)" value={price.quotedPrice} onChange={v=>set("quotedPrice",v)}/>
      <NumField label="Negotiated price (₹)" value={price.negotiatedPrice} onChange={v=>set("negotiatedPrice",v)}/><NumField label="Additional costs (₹)" value={price.additionalCosts} onChange={v=>set("additionalCosts",v)}/>
      <p className="ps-group col-span-2">Area</p>
      <NumField label="Area (sq ft)" value={price.areaSqft} onChange={v=>set("areaSqft",v)}/><NumField label="Area (guntha)" value={price.areaGuntha} onChange={v=>set("areaGuntha",v)}/>
      <NumField label="Area (acre)" value={price.areaAcre} onChange={v=>set("areaAcre",v)}/>
      <p className="ps-group col-span-2">Access</p>
      <NumField label="Road width" value={price.roadWidthFt} onChange={v=>set("roadWidthFt",v)} suffix="ft"/>
      <NumField label="Main road distance" value={price.mainRoadDistanceM} onChange={v=>set("mainRoadDistanceM",v)} suffix="m"/>
    </div>
    {e.areaMismatch && <div className="ps-callout is-warn"><p className="text-field-warn text-sm font-medium">Area mismatch detected</p><p className="text-field-muted text-xs mt-1">Entered area units differ by {e.mismatchPct.toFixed(1)}%. Recheck before using price analysis.</p></div>}
    {e.effectivePrice && e.areaSqft && (
      <div className="ps-econ">
        <p className="ps-econ-kicker">Effective price analysis</p>
        <p className="ps-econ-value font-display tabular-nums">{money(e.perSqft!)}<span> / sq ft</span></p>
        <dl className="ps-econ-grid">
          <div><dt>Per guntha</dt><dd className="font-display tabular-nums">{money(e.perGuntha!)}</dd></div>
          <div><dt>Per acre</dt><dd className="font-display tabular-nums">{money(e.perAcre!)}</dd></div>
          {e.totalAcquisition && <div className="col-span-2"><dt>Acquisition total</dt><dd className="font-display tabular-nums">{money(e.totalAcquisition)}</dd></div>}
        </dl>
        {e.discountPct !== null && <p className={`ps-econ-note ${e.discountPct >= 0 ? "is-good" : "is-warn"}`}>{e.discountPct >= 0 ? `${e.discountPct.toFixed(1)}% below asking (${money(e.discountAmount!)})` : `${Math.abs(e.discountPct).toFixed(1)}% above asking`}</p>}
        <p className="ps-econ-foot">1 guntha ≈ {GUNTHA_TO_SQFT.toLocaleString("en-IN")} sq ft. Effective price priority: negotiated → quoted → asking.</p>
      </div>
    )}
  </div>;
}

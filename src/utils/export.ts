import { PropertyRecord, CHECKLIST_ITEMS, OWNER_QUESTIONS } from "../types";
import { computeScore } from "./scoring";
import { googleMapsPointUrl } from "./geo";
import { economics } from "./economics";
import { getBuyerProfile, computeBuyerFit } from "../personalization";
import { beforeTokenDecision } from "./decision";

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportPropertyJson(property: PropertyRecord) {
  downloadBlob(
    `${property.name.replace(/\s+/g, "_")}_${property.id}.json`,
    JSON.stringify(property, null, 2),
    "application/json"
  );
}

export function exportAllJson(properties: PropertyRecord[]) {
  downloadBlob("land_scout_pro_all_properties.json", JSON.stringify(properties, null, 2), "application/json");
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportPropertyCsv(property: PropertyRecord) {
  exportCsvFile([property], `${property.name.replace(/\s+/g, "_")}_${property.id}.csv`);
}

function exportCsvFile(properties: PropertyRecord[], filename: string) {
  const headers = [
    "id",
    "name",
    "createdAt",
    "district", "taluka", "village", "gatNo", "surveyNo", "hissaNo", "plotNo", "identityStatus", "parcelStatus", "parcelRefLat", "parcelRefLng", "gpsParcelDistanceM", "gpsParcelAssessment",
    "lat",
    "lng",
    "gpsAccuracyM",
    "quotedPrice",
    "askingPrice",
    "areaSqft",
    "areaGuntha",
    "pricePerSqft",
    "pricePerGuntha",
    "roadWidthFt",
    "mainRoadDistanceM",
    "score",
    "status",
    "followUp"
  ];
  const rows = properties.map((p) => {
    const score = computeScore(p);
    const pricePerSqft =
      p.price.quotedPrice && p.price.areaSqft ? (p.price.quotedPrice / p.price.areaSqft).toFixed(2) : "";
    const pricePerGuntha =
      p.price.quotedPrice && p.price.areaGuntha ? (p.price.quotedPrice / p.price.areaGuntha).toFixed(2) : "";
    return [
      p.id,
      p.name,
      new Date(p.createdAt).toISOString(),
      p.identity?.district ?? "", p.identity?.taluka ?? "", p.identity?.village ?? "", p.identity?.gatNo ?? "", p.identity?.surveyNo ?? "", p.identity?.hissaNo ?? "", p.identity?.plotNo ?? "", p.identity?.provenance ?? "", p.parcelIntel?.status ?? "not_checked", p.parcelIntel?.parcelLat ?? "", p.parcelIntel?.parcelLng ?? "", p.parcelIntel?.mismatchMeters ?? "", p.parcelIntel?.mismatchAssessment ?? "CANNOT_DETERMINE",
      p.location?.lat ?? "",
      p.location?.lng ?? "",
      p.location?.accuracy ?? "",
      p.price.quotedPrice ?? "",
      p.price.askingPrice ?? "",
      p.price.areaSqft ?? "",
      p.price.areaGuntha ?? "",
      pricePerSqft,
      pricePerGuntha,
      p.price.roadWidthFt ?? "",
      p.price.mainRoadDistanceM ?? "",
      score.total,
      p.finalStatus,
      p.followUp
    ]
      .map(csvEscape)
      .join(",");
  });
  downloadBlob(filename, [headers.join(","), ...rows].join("\n"), "text/csv");
}

export function exportAllCsv(properties: PropertyRecord[]) {
  exportCsvFile(properties, "land_scout_pro_all_properties.csv");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPrintableReportHtml(property: PropertyRecord): string {
  // Freeze every derived value once for this report render. The property dossier itself remains local.
  const generatedAt = new Date();
  const score = computeScore(property);
  const eco = economics(property.price);
  const loc = property.location;
  const profile = getBuyerProfile();
  const fit = profile.enabled ? computeBuyerFit(property, profile) : null;
  const money=(n:number|null|undefined)=>n==null?"—":`₹${Math.round(n).toLocaleString("en-IN")}`;
  const num=(n:number|null|undefined,d=2)=>n==null?"—":Number(n.toFixed(d)).toLocaleString("en-IN");
  const date=(n:number|null|undefined)=>n?new Date(n).toLocaleString("en-IN"):"—";
  const identity=property.identity;
  const mapsLink=loc?googleMapsPointUrl(loc.lat,loc.lng):"";

  const decisionModel = beforeTokenDecision(property);
  const decision = { label: decisionModel.label, cls: decisionModel.tone, why: decisionModel.why };
  const verifyItems = decisionModel.verifyNext;

  const identityRows = [
    ["State",identity?.state],["District",identity?.district],["Taluka",identity?.taluka],["Village",identity?.village],
    ["Gat No.",identity?.gatNo],["Survey No.",identity?.surveyNo],["Hissa No.",identity?.hissaNo],["Plot No.",identity?.plotNo],
    ["Owner / stated owner",identity?.ownerName],["Broker / source person",identity?.brokerName],["Contact",identity?.contact],
    ["Source reference",identity?.sourceReference],["Identity provenance",identity?.provenance || "USER_ENTERED"]
  ].map(([a,b])=>`<tr><td>${escapeHtml(a)}</td><td>${escapeHtml(b||"—")}</td></tr>`).join("");

  const mapRows=[
    property.mapIntel.nearestRoad&&["Nearest mapped road",property.mapIntel.nearestRoad],
    property.mapIntel.nearestMajorRoad&&["Nearest major road",property.mapIntel.nearestMajorRoad],
    property.mapIntel.nearestHighway&&["Nearest highway / arterial",property.mapIntel.nearestHighway]
  ].filter(Boolean).map((x:any)=>`<tr><td>${x[0]}</td><td>${escapeHtml(x[1].name||"Unnamed mapped feature")} · ~${Math.round(x[1].distanceMeters)} m straight-line · ${escapeHtml(x[1].source||"OpenStreetMap")}</td></tr>`).join("");

  const poiSummary = [
    ["Residential",property.mapIntel.residential.length],["Education",property.mapIntel.education.length],
    ["Sports",property.mapIntel.sports.length],["Access / amenities",property.mapIntel.access.length]
  ].map(([a,b])=>`<div class="mini"><b>${b}</b><span>${a}</span></div>`).join("");

  const scoreRows=Object.entries(score.breakdown).map(([k,v])=>`<tr><td>${escapeHtml(k.replace(/([A-Z])/g," $1"))}</td><td><b>${v}</b></td></tr>`).join("");
  const groundRows = CHECKLIST_ITEMS.filter(item=>property.checklist[item.id]!==undefined&&property.checklist[item.id]!==null)
    .map(item=>`<tr><td>${escapeHtml(item.label)}</td><td>${property.checklist[item.id]===true?"Yes":"No"}</td></tr>`).join("");
  const ownerRows = OWNER_QUESTIONS.filter(q=>(property.ownerAnswers[q.id]||"").trim())
    .map(q=>`<tr><td>${escapeHtml(q.text)}</td><td>${escapeHtml(property.ownerAnswers[q.id])}</td></tr>`).join("");

  const photoLabels:Record<string,string>={front_road:"Front / road",plot:"Plot",left_side:"Left side",right_side:"Right side",rear:"Rear",surrounding:"Surrounding",access_road:"Access road",documents:"Document image"};
  const photos=property.photos.map(photo=>`<figure><img src="${photo.dataUrl}"><figcaption><b>${escapeHtml(photoLabels[photo.category]||photo.category)}</b>${photo.caption?` · ${escapeHtml(photo.caption)}`:""}<br>${date(photo.addedAt)}</figcaption></figure>`).join("");
  const flags = score.criticalFlags.length ? score.criticalFlags.map(x=>`<div class="flag badflag">${escapeHtml(x)}</div>`).join("") : `<div class="flag okflag">No structured critical flag is currently recorded. This is not legal clearance.</div>`;
  const verify = verifyItems.length ? verifyItems.map((x,i)=>`<li><b>${i+1}.</b> ${escapeHtml(x)}</li>`).join("") : `<li>No additional field-data gap generated by the current rule set. Independent legal verification is still required before commitment.</li>`;
  const positives = score.positives.length ? score.positives.map(x=>`<li>${escapeHtml(x)}</li>`).join("") : `<li>No strong positive signal recorded yet.</li>`;

  const buyerFit = fit ? `<section class="section"><div class="section-head"><span>08</span><h2>Buyer Fit</h2></div><div class="fitbox"><div><div class="eyebrow">${escapeHtml(profile.name||"Saved criteria")}</div><b class="fitlabel">${escapeHtml(fit.label)}</b><p>${fit.checked}/${fit.configured} configured criteria evaluated · ${fit.coveragePct}% coverage · Confidence ${fit.confidence}</p></div><div class="fitscore">${fit.score==null?"—":fit.score+"/100"}</div></div>${fit.conflicts.length?`<h3>Conflicts</h3><ul>${fit.conflicts.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:""}${fit.verify.length?`<h3>Needs verification</h3><ul>${fit.verify.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:""}<p class="fine">Buyer Fit is separate from the objective Plot Scout score. Missing information lowers coverage/confidence and is not scored as zero.</p></section>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(property.name)} — Before-Token Decision Report</title><style>
  :root{--ink:#181b18;--muted:#687068;--line:#d9ddd7;--gold:#9b7420;--cream:#f6f1e5;--green:#1e5a3c;--amber:#8a5b00;--red:#8a2929}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:var(--ink);padding:30px;max-width:920px;margin:auto;line-height:1.45;background:#fff}.cover{border-top:8px solid #1e241f;padding-top:24px}.brand{font-size:13px;font-weight:800;letter-spacing:.08em;color:var(--gold)}.eyebrow{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}h1{font-size:34px;line-height:1.05;margin:8px 0 10px}.sub{color:var(--muted);max-width:700px}.decision{margin:24px 0;padding:18px;border:1px solid var(--line);border-left:6px solid var(--amber);background:#fbfaf7}.decision.good{border-left-color:var(--green)}.decision.bad{border-left-color:var(--red)}.decision.neutral{border-left-color:#777}.decision strong{display:block;font-size:20px;margin:3px 0}.scorebar{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.stat{border:1px solid var(--line);padding:10px}.stat b{display:block;font-size:20px}.stat span{font-size:10px;color:var(--muted);text-transform:uppercase}.section{margin-top:28px;break-inside:auto}.section-head{display:flex;align-items:center;gap:8px;border-bottom:2px solid #272c28;padding-bottom:5px;margin-bottom:8px}.section-head span{font-size:10px;color:var(--gold);font-weight:800}.section-head h2{font-size:16px;margin:0}h3{font-size:12px;margin:14px 0 4px}table{width:100%;border-collapse:collapse}td{padding:6px 8px;border-bottom:1px solid #eceeeb;font-size:11.5px;vertical-align:top}td:first-child{color:var(--muted);width:42%}.twocol{display:grid;grid-template-columns:1fr 1fr;gap:18px}.minirow{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:8px}.mini{border:1px solid var(--line);padding:7px}.mini b{display:block}.mini span{font-size:9px;color:var(--muted)}ul{padding-left:20px;margin:7px 0}li{font-size:11.5px;margin:5px 0}.flag{padding:8px 10px;border:1px solid var(--line);margin:6px 0;font-size:11.5px}.badflag{background:#fff5f3;border-color:#e4c0ba}.okflag{background:#f3f8f4;border-color:#c9d9cd}.evidence{display:grid;grid-template-columns:1fr 1fr;gap:10px}.evidence figure{margin:0 0 10px;break-inside:avoid}.evidence img{width:100%;height:260px;object-fit:cover;border:1px solid var(--line)}figcaption{font-size:9.5px;color:var(--muted);margin-top:4px}.fitbox{display:flex;justify-content:space-between;align-items:center;background:var(--cream);padding:12px}.fitlabel{font-size:16px}.fitscore{font-size:24px;font-weight:800}.notes{white-space:pre-wrap;font-size:11.5px}.fine{font-size:9.5px;color:var(--muted)}.footer{margin-top:30px;border-top:2px solid #272c28;padding-top:10px;font-size:9.5px;color:var(--muted)}.pagebreak{break-before:page}@media(max-width:650px){.twocol,.evidence{grid-template-columns:1fr}.scorebar,.minirow{grid-template-columns:1fr 1fr}}@media print{body{padding:0;max-width:none}.no-print{display:none}.section{break-inside:auto}a{color:inherit;text-decoration:none}}
  </style></head><body>
  <header class="cover"><div class="brand">PLOT SCOUT · FIELD INTELLIGENCE DOSSIER</div><div class="eyebrow">Before-Token Decision Report</div><h1>${escapeHtml(property.name)}</h1><p class="sub">Evidence-backed field decision pack for deciding whether this specific plot deserves further legal due diligence before committing money.</p><p class="fine">Report generated ${generatedAt.toLocaleString("en-IN")} · Property record created ${date(property.createdAt)} · Record ID ${escapeHtml(property.id)}</p></header>
  <div class="decision ${decision.cls}"><div class="eyebrow">Current decision state</div><strong>${decision.label}</strong><p>${escapeHtml(decision.why)}</p></div>
  <div class="scorebar"><div class="stat"><b>${score.total}/100</b><span>Objective score</span></div><div class="stat"><b>${score.confidence}</b><span>Confidence</span></div><div class="stat"><b>${property.photos.length}</b><span>Evidence items</span></div><div class="stat"><b>${score.criticalFlags.length}</b><span>Critical flags</span></div></div>

  <section class="section"><div class="section-head"><span>01</span><h2>Property Identity & Provenance</h2></div><table>${identityRows}</table><p class="fine">Identity fields record what was entered or supplied. They do not by themselves establish legal ownership, title or parcel boundary.</p></section>

  <section class="section"><div class="section-head"><span>02</span><h2>Location & Automatic Field Intelligence</h2></div><div class="twocol"><div><table><tr><td>Coordinates</td><td>${loc?`${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`:"—"}</td></tr><tr><td>Location source</td><td>${escapeHtml(loc?.source||"—")}</td></tr><tr><td>Recorded accuracy</td><td>${loc?.accuracy==null?"—":`±${Math.round(loc.accuracy)} m`}</td></tr><tr><td>Captured</td><td>${date(loc?.timestamp)}</td></tr><tr><td>Google Maps</td><td>${mapsLink?`<a href="${escapeHtml(mapsLink)}">Open captured point</a>`:"—"}</td></tr></table></div><div><table>${mapRows||'<tr><td>Map intelligence</td><td>Not recorded</td></tr>'}</table><div class="minirow">${poiSummary}</div></div></div><p class="fine">Map intelligence status: ${escapeHtml(property.mapIntel.status)}${property.mapIntel.fetchedAt?` · fetched ${date(property.mapIntel.fetchedAt)}`:""}. Distances are approximate straight-line map signals. GPS/OSM do not prove cadastral boundary or legal access.</p></section>

  <section class="section"><div class="section-head"><span>03</span><h2>Ground Truth & Source Answers</h2></div><div class="twocol"><div><h3>Observed / checked on ground</h3><table>${groundRows||'<tr><td>Ground checks</td><td>Not recorded</td></tr>'}</table></div><div><h3>Owner / source answers</h3><table>${ownerRows||'<tr><td>Source answers</td><td>Not recorded</td></tr>'}</table></div></div></section>

  <section class="section"><div class="section-head"><span>04</span><h2>Land Economics</h2></div><table><tr><td>Asking price</td><td>${money(property.price.askingPrice)}</td></tr><tr><td>Quoted price</td><td>${money(property.price.quotedPrice)}</td></tr><tr><td>Negotiated price</td><td>${money(property.price.negotiatedPrice)}</td></tr><tr><td>Additional costs</td><td>${money(property.price.additionalCosts)}</td></tr><tr><td>Effective price</td><td>${money(eco.effectivePrice)}</td></tr><tr><td>Estimated acquisition total</td><td><b>${money(eco.totalAcquisition)}</b></td></tr><tr><td>Area</td><td>${num(eco.areaGuntha)} guntha · ${num(eco.areaSqft,0)} sq ft · ${num(eco.areaAcre,3)} acre</td></tr><tr><td>Price / sq ft</td><td>${money(eco.perSqft)}</td></tr><tr><td>Price / guntha</td><td>${money(eco.perGuntha)}</td></tr><tr><td>Price / acre</td><td>${money(eco.perAcre)}</td></tr><tr><td>Road width entered</td><td>${property.price.roadWidthFt==null?"—":property.price.roadWidthFt+" ft"}</td></tr><tr><td>Area consistency</td><td>${eco.areaMismatch?`CHECK — entered units differ by ${eco.mismatchPct.toFixed(1)}%`:"No >3% entered-unit mismatch detected"}</td></tr></table><p class="fine">This normalizes entered economics only; it is not an independent market valuation or appreciation forecast.</p></section>

  <section class="section"><div class="section-head"><span>05</span><h2>Objective Decision Engine</h2></div><div class="twocol"><table>${scoreRows}</table><div><h3>Positive signals</h3><ul>${positives}</ul><h3>Critical / unresolved flags</h3>${flags}</div></div></section>

  <section class="section"><div class="section-head"><span>06</span><h2>Before Paying Token — Verify Next</h2></div><ol>${verify}</ol><p class="fine">This is a prioritised handoff list generated from missing or concerning field evidence. It does not replace an advocate, licensed surveyor, valuer, government record or competent authority.</p></section>

  <section class="section"><div class="section-head"><span>07</span><h2>Evidence Vault</h2></div>${property.photos.length?`<div class="evidence">${photos}</div>`:'<p class="fine">No photo evidence attached to this record.</p>'}</section>
  ${buyerFit}
  <section class="section"><div class="section-head"><span>${fit?"09":"08"}</span><h2>Notes & Follow-up</h2></div><p class="notes"><b>Site:</b> ${escapeHtml(property.notes.site||"—")}</p><p class="notes"><b>Owner/source:</b> ${escapeHtml(property.notes.owner||"—")}</p><p class="notes"><b>General:</b> ${escapeHtml(property.notes.general||"—")}</p><p class="notes"><b>Follow-up:</b> ${escapeHtml(property.followUp||"—")}</p></section>

  <footer class="footer"><b>Important legal boundary.</b> Plot Scout is a field decision-support tool, not a title certificate, cadastral survey, legal opinion, government approval, valuation or guarantee. Map distances and nearby features are indicative. Phone GPS does not establish exact parcel boundaries. Uploaded/photographed documents are evidence items only and are not automatically authenticated. Ownership, title, encumbrances, zoning, NA status, legal access/right of way, boundaries, permissions and transaction safety require independent verification through the appropriate professionals and authoritative records.</footer>
  </body></html>`;
}

export function printPropertyReport(property: PropertyRecord) {
  const html = buildPrintableReportHtml(property);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup blocked. Allow popups to open the Before-Token Decision Report.");
    return;
  }
  win.onload = () => { win.focus(); setTimeout(() => win.print(), 250); };
  win.document.write(html);
  win.document.close();
}

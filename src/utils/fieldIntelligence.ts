import { MapIntel, PropertyRecord } from "../types";

export type SmartQuestion = {
  id: string;
  title: string;
  hint: string;
  options: string[];
  priority: "critical" | "important" | "context";
};
export type AutoSignal = { label: string; value: string; tone: "good" | "warn" | "neutral" };
export type FieldSnapshot = { headline: string; summary: string; confidence: "High" | "Medium" | "Low"; flags: string[] };

const km = (m: number) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
const answered = (p: PropertyRecord, id: string) => (p.ownerAnswers[id] || "").trim();
const intelReady = (i: MapIntel) => i.status === "ok" || i.status === "partial";

export function autoSignals(intel: MapIntel): AutoSignal[] {
  if (!intelReady(intel)) return [];
  const out: AutoSignal[] = [];
  if (intel.nearestRoad) out.push({ label: "Mapped road · straight-line", value: km(intel.nearestRoad.distanceMeters), tone: intel.nearestRoad.distanceMeters <= 80 ? "good" : "warn" });
  if (intel.nearestMajorRoad) out.push({ label: "Major road · straight-line", value: km(intel.nearestMajorRoad.distanceMeters), tone: intel.nearestMajorRoad.distanceMeters <= 1000 ? "good" : "neutral" });
  if (intel.nearestHighway) out.push({ label: "Highway / arterial · straight-line", value: km(intel.nearestHighway.distanceMeters), tone: intel.nearestHighway.distanceMeters <= 2000 ? "good" : "neutral" });
  out.push({ label: "Residential map signals", value: String(intel.residential.length), tone: intel.residential.length >= 2 ? "good" : "neutral" });
  out.push({ label: "Education map signals", value: String(intel.education.length), tone: intel.education.length ? "good" : "neutral" });
  out.push({ label: "Convenience map signals", value: String(intel.access.length), tone: intel.access.length >= 2 ? "good" : "neutral" });
  return out.slice(0, 6);
}

export function fieldSnapshot(p: PropertyRecord): FieldSnapshot {
  const i = p.mapIntel;
  if (!p.location) return { headline: "Location needed", summary: "Capture the field pin and Plot Scout will build the first site snapshot automatically.", confidence: "Low", flags: [] };
  if (!intelReady(i)) return { headline: "Building field context", summary: "Location is captured. Surroundings intelligence is the next automatic signal.", confidence: "Low", flags: [] };

  const flags: string[] = [];
  if (!i.nearestRoad) flags.push("No mapped road found in search radius");
  else if (i.nearestRoad.distanceMeters > 80) flags.push("Mapped road is relatively far from the pin");
  if (i.residential.length === 0) flags.push("Sparse mapped residential activity");
  const access = answered(p, "smart_access");
  if (access === "Difficult / narrow" || access === "No clear access") flags.push("Ground access needs investigation");
  const physical = answered(p, "smart_physical");
  if (physical && physical !== "None visible") flags.push(physical);
  if (answered(p, "smart_boundary") === "Not identifiable") flags.push("Boundary not identifiable on ground");

  const activity = i.residential.length + i.education.length + i.access.length;
  const strongRoad = Boolean(i.nearestRoad && i.nearestRoad.distanceMeters <= 40);
  const headline = flags.length ? "Useful site — verify the flagged items" : strongRoad && activity >= 3 ? "Promising mapped context" : "Field context captured";
  const roadText = i.nearestRoad ? `mapped road ${km(i.nearestRoad.distanceMeters)} away (straight-line)` : "no mapped road confirmed";
  const summary = `${roadText}; ${activity} nearby mapped activity signal${activity === 1 ? "" : "s"}. Map context is indicative; ground evidence overrides it.`;
  const humanChecks = ["smart_boundary", "smart_physical"].filter((id) => answered(p, id)).length;
  const groundAccessChecked = Boolean(answered(p, "smart_access"));
  // A close mapped road can suppress a redundant usability question, but it must never elevate
  // field confidence to High by itself. High requires an explicit ground-access observation.
  const confidence: FieldSnapshot["confidence"] = humanChecks === 2 && groundAccessChecked ? "High" : humanChecks >= 1 ? "Medium" : "Low";
  return { headline, summary, confidence, flags: flags.slice(0, 4) };
}

export function smartQuestions(p: PropertyRecord): SmartQuestion[] {
  const q: SmartQuestion[] = [];
  const i = p.mapIntel;
  const ready = intelReady(i);
  const roadDistance = i.nearestRoad?.distanceMeters;
  const roadUncertain = !ready || roadDistance == null || roadDistance > 40;

  // Ask ground-access only when map context cannot already show a close mapped road.
  // A close mapped road is NOT legal-access proof; legal verification remains separate.
  if (roadUncertain || answered(p, "smart_access")) {
    q.push({
      id: "smart_access",
      title: ready ? "Map se direct usable entry clear nahi hai. Ground par actual approach kaisi hai?" : "Ground par actual approach road usable hai?",
      hint: "Mapped road legal/right-of-way access prove nahi karti.",
      options: ["Good car access", "Difficult / narrow", "No clear access"],
      priority: "critical"
    });
  }

  const access = answered(p, "smart_access");
  if (access === "Difficult / narrow" || access === "No clear access") {
    q.push({ id: "smart_access_proof", title: "Access concern ke liye owner ke paas road/right-of-way proof hai?", hint: "Evidence status capture karo; legal conclusion app nahi dega.", options: ["Proof seen", "Claimed, not seen", "No proof shown"], priority: "critical" });
  }

  // These are intentionally human-only checks: maps cannot safely infer them.
  q.push({ id: "smart_boundary", title: "Plot ki physical boundary ground par identify ho rahi hai?", hint: "Compound, stones, fencing ya owner-demarcated corners dekho.", options: ["Clearly visible", "Partly visible", "Not identifiable"], priority: "important" });
  q.push({ id: "smart_physical", title: "Koi obvious physical problem dikh rahi hai?", hint: "Sirf jo aap ground par actually dekh rahe ho.", options: ["None visible", "Water / drainage", "Encroachment concern", "HT line / obstruction", "Other concern"], priority: "important" });

  const hasId = Boolean(p.identity?.gatNo?.trim() || p.identity?.surveyNo?.trim());
  if (hasId || answered(p, "smart_record")) {
    q.push({ id: "smart_record", title: "Is Gat/Survey ke supporting land records dikhaye gaye?", hint: "Record dekhna ownership/title verification ke barabar nahi hai.", options: ["Seen / captured", "Shown, not captured", "Not shown yet"], priority: "critical" });
  }

  if (ready && i.residential.length === 0) {
    q.push({ id: "smart_services", title: "Mapped residential activity sparse hai. Basic services ground par visible hain?", hint: "Electricity, water arrangement, drainage aur occupied development dekho.", options: ["Most visible", "Some visible", "Very limited"], priority: "context" });
  } else if (ready && !answered(p, "smart_dealbreaker")) {
    q.push({ id: "smart_dealbreaker", title: "Site par koi deal-stopping issue dekha?", hint: "Agar nahi, unnecessary issue invent mat karo.", options: ["No", "Yes — investigate"], priority: "important" });
  }

  return q.slice(0, 5);
}

export function evidencePrompts(p: PropertyRecord): string[] {
  const prompts: string[] = [];
  const access = answered(p, "smart_access");
  if (access === "Difficult / narrow" || access === "No clear access") prompts.push("Approach road / access concern photo");
  const boundary = answered(p, "smart_boundary");
  if (boundary === "Partly visible" || boundary === "Not identifiable") prompts.push("Boundary / corner evidence");
  const physical = answered(p, "smart_physical");
  if (physical && physical !== "None visible") prompts.push(`Evidence: ${physical}`);
  if (answered(p, "smart_record") === "Seen / captured" && !p.photos.some((x) => x.category === "documents")) prompts.push("Land-record photo");
  if (p.photos.length === 0) prompts.push("Wide plot overview");
  return [...new Set(prompts)].slice(0, 3);
}

export function beforeYouLeave(p: PropertyRecord) {
  const missing: string[] = [];
  if (!p.location) missing.push("Capture current location");
  if (!intelReady(p.mapIntel)) missing.push("Run surroundings intelligence");
  for (const q of smartQuestions(p)) if (!answered(p, q.id)) missing.push(q.title);
  for (const e of evidencePrompts(p)) missing.push(`Photo: ${e}`);
  if (!(p.identity?.gatNo?.trim() || p.identity?.surveyNo?.trim())) missing.push("Record Gat / Survey number if available");
  return [...new Set(missing)].slice(0, 5);
}

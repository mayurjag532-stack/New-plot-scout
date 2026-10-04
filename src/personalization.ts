import { PropertyRecord } from "./types";
import { economics } from "./utils/economics";

export type RequirementLevel = "MANDATORY" | "PREFERRED" | "IGNORE";
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";
export type IntendedUse = "INVESTMENT" | "HOME" | "FARM" | "COMMERCIAL" | "OTHER";

export interface BuyerProfile {
  enabled: boolean;
  name: string;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocations: string;
  minAreaGuntha: number | null;
  maxAreaGuntha: number | null;
  intendedUse: IntendedUse;
  highwayRequirement: RequirementLevel;
  maxHighwayDistanceM: number | null;
  carAccessRequirement: RequirementLevel;
  minRoadWidthFt: number | null;
  riskTolerance: RiskTolerance;
  priorities: string;
  dealBreakers: string;
  updatedAt: number;
}

export interface BuyerFitResult {
  score: number | null;
  label: "EXCELLENT MATCH" | "GOOD MATCH" | "PARTIAL MATCH" | "POOR MATCH" | "NOT ENOUGH DATA";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  matches: string[];
  conflicts: string[];
  verify: string[];
  checked: number;
  configured: number;
  coveragePct: number;
}

const KEY = "plot-scout:buyer-profile:v1";

export const defaultBuyerProfile = (): BuyerProfile => ({
  enabled: false,
  name: "My Land Criteria",
  budgetMin: null,
  budgetMax: null,
  preferredLocations: "",
  minAreaGuntha: null,
  maxAreaGuntha: null,
  intendedUse: "INVESTMENT",
  highwayRequirement: "IGNORE",
  maxHighwayDistanceM: null,
  carAccessRequirement: "IGNORE",
  minRoadWidthFt: null,
  riskTolerance: "MEDIUM",
  priorities: "",
  dealBreakers: "",
  updatedAt: Date.now(),
});

export function getBuyerProfile(): BuyerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaultBuyerProfile(), ...JSON.parse(raw) } : defaultBuyerProfile();
  } catch {
    return defaultBuyerProfile();
  }
}

export function saveBuyerProfile(profile: BuyerProfile) {
  const next = { ...profile, updatedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("plot-scout-profile-change", { detail: { profile: next } }));
  return next;
}

export function clearBuyerProfile() {
  const next = defaultBuyerProfile();
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("plot-scout-profile-change", { detail: { profile: next } }));
  return next;
}

export function exportBuyerProfile() { return getBuyerProfile(); }
export function importBuyerProfile(value: unknown) {
  if (!value || typeof value !== "object") return;
  saveBuyerProfile({ ...defaultBuyerProfile(), ...(value as Partial<BuyerProfile>) });
}

const num = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Buyer Fit only scores criteria that are actually evaluable from recorded evidence.
 * Missing/uncertain data reduces coverage/confidence; it never behaves like a zero score.
 */
export function computeBuyerFit(p: PropertyRecord, profile: BuyerProfile): BuyerFitResult {
  const empty: BuyerFitResult = {
    score: null, label: "NOT ENOUGH DATA", confidence: "LOW",
    matches: [], conflicts: [], verify: [], checked: 0, configured: 0, coveragePct: 0,
  };
  if (!profile.enabled) return empty;

  let configuredWeight = 0;
  let evaluatedWeight = 0;
  let earnedWeight = 0;
  let configuredCriteria = 0;
  let evaluatedCriteria = 0;
  const matches: string[] = [];
  const conflicts: string[] = [];
  const verify: string[] = [];

  const criterion = (
    weight: number,
    state: "match" | "conflict" | "unknown",
    text: string,
  ) => {
    configuredWeight += weight;
    configuredCriteria += 1;
    if (state === "unknown") {
      verify.push(text);
      return;
    }
    evaluatedWeight += weight;
    evaluatedCriteria += 1;
    if (state === "match") {
      earnedWeight += weight;
      matches.push(text);
    } else {
      conflicts.push(text);
    }
  };

  const eco = economics(p.price);
  const price = num(eco.totalAcquisition) ?? num(eco.effectivePrice);

  // Treat a budget band as one criterion, not two opportunities to inflate/deflate the score.
  if (profile.budgetMin != null || profile.budgetMax != null) {
    if (price == null) {
      criterion(4, "unknown", "Price is missing, so budget fit cannot be checked");
    } else if (profile.budgetMax != null && price > profile.budgetMax) {
      criterion(4, "conflict", `Estimated acquisition exceeds your ₹${profile.budgetMax.toLocaleString("en-IN")} maximum`);
    } else if (profile.budgetMin != null && price < profile.budgetMin) {
      criterion(4, "conflict", "Price is below your saved budget band");
    } else {
      criterion(4, "match", "Price is within your saved budget band");
    }
  }

  const area = num(eco.areaGuntha);
  if (profile.minAreaGuntha != null || profile.maxAreaGuntha != null) {
    if (area == null) {
      criterion(3, "unknown", "Land area is missing, so area fit cannot be checked");
    } else if (profile.minAreaGuntha != null && area < profile.minAreaGuntha) {
      criterion(3, "conflict", `Area is below your ${profile.minAreaGuntha} guntha minimum`);
    } else if (profile.maxAreaGuntha != null && area > profile.maxAreaGuntha) {
      criterion(3, "conflict", `Area exceeds your ${profile.maxAreaGuntha} guntha maximum`);
    } else {
      criterion(3, "match", "Land area is within your saved range");
    }
  }

  if (profile.preferredLocations.trim()) {
    const hay = [p.identity?.village, p.identity?.taluka, p.identity?.district, p.identity?.state]
      .filter(Boolean).join(" ").toLowerCase();
    const wants = profile.preferredLocations.toLowerCase().split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
    if (!hay.trim()) criterion(3, "unknown", "Property location identity is incomplete");
    else if (wants.some(x => hay.includes(x))) criterion(3, "match", "Property is in your preferred location list");
    else criterion(3, "conflict", "Property is outside your saved preferred locations");
  }

  if (profile.highwayRequirement !== "IGNORE") {
    const weight = profile.highwayRequirement === "MANDATORY" ? 5 : 2;
    const h = p.mapIntel.nearestHighway;
    const gpsUncertain = p.location?.source === "gps" && (p.location.accuracy == null || p.location.accuracy > 75);
    const mapUsable = p.mapIntel.status === "ok" || p.mapIntel.status === "partial";
    if (!mapUsable || !h) {
      criterion(weight, "unknown", "Highway fit is not available from current map data");
    } else if (gpsUncertain) {
      criterion(weight, "unknown", `Highway is mapped about ${Math.round(h.distanceMeters)} m away, but the captured GPS pin is too uncertain for a reliable fit check`);
    } else {
      const limit = profile.maxHighwayDistanceM ?? (profile.highwayRequirement === "MANDATORY" ? 100 : 1000);
      if (h.distanceMeters <= limit) {
        criterion(weight, "match", `Mapped highway is about ${Math.round(h.distanceMeters)} m away (straight-line)`);
      } else {
        criterion(weight, "conflict", `Mapped highway is about ${Math.round(h.distanceMeters)} m away, beyond your ${limit} m preference (straight-line)`);
      }
    }
  }

  if (profile.carAccessRequirement !== "IGNORE") {
    const weight = profile.carAccessRequirement === "MANDATORY" ? 5 : 2;
    const answer = (p.ownerAnswers.smart_access || "").trim();
    if (!answer) criterion(weight, "unknown", "Usable vehicle access still needs a ground check");
    else if (answer === "Good car access") criterion(weight, "match", "Ground check indicates good car access");
    else criterion(weight, "conflict", profile.carAccessRequirement === "MANDATORY"
      ? "Ground access conflicts with your mandatory vehicle-access requirement"
      : "Ground access is weaker than preferred");
  }

  if (profile.minRoadWidthFt != null) {
    const rw = num(p.price.roadWidthFt);
    if (rw == null) criterion(3, "unknown", "Road width is not recorded");
    else if (rw >= profile.minRoadWidthFt) criterion(3, "match", "Road width meets your minimum");
    else criterion(3, "conflict", `Road width is below your ${profile.minRoadWidthFt} ft minimum`);
  }

  if (configuredWeight === 0) return empty;

  const coveragePct = Math.round((evaluatedWeight / configuredWeight) * 100);
  const confidence: BuyerFitResult["confidence"] = coveragePct >= 80 ? "HIGH" : coveragePct >= 50 ? "MEDIUM" : "LOW";

  // One isolated known fact should not create a persuasive-looking 0/100 or 100/100.
  const enoughEvidence = evaluatedCriteria >= 2 && coveragePct >= 40;
  if (!enoughEvidence || evaluatedWeight === 0) {
    return {
      score: null,
      label: "NOT ENOUGH DATA",
      confidence,
      matches,
      conflicts,
      verify,
      checked: evaluatedCriteria,
      configured: configuredCriteria,
      coveragePct,
    };
  }

  const score = Math.round((earnedWeight / evaluatedWeight) * 100);
  const label: BuyerFitResult["label"] = score >= 85 ? "EXCELLENT MATCH"
    : score >= 70 ? "GOOD MATCH"
    : score >= 45 ? "PARTIAL MATCH"
    : "POOR MATCH";

  return { score, label, confidence, matches, conflicts, verify, checked: evaluatedCriteria, configured: configuredCriteria, coveragePct };
}

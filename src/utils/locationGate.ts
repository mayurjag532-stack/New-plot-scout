export type LocationGateStatus = "UNVERIFIED" | "NEEDS_REVIEW" | "VERIFIED" | "LOCATION_CONFLICT";
export type LocationConflictLevel = "NONE" | "SOFT" | "HARD";
export type LocationLevel = "country" | "state" | "district" | "taluka" | "village";

export interface LocationHierarchy {
  country?: string;
  state?: string;
  district?: string;
  taluka?: string;
  village?: string;
}

export interface TrustedResolvedLocation extends LocationHierarchy {
  lat?: number;
  lon?: number;
  evidenceId?: string;
}

export interface LocationGateInput {
  // Search scope is deliberately accepted only as context and is NEVER used as evidence.
  searchScope?: LocationHierarchy;
  sourceLocation: LocationHierarchy;
  sourceEvidenceIds?: string[];
  trustedResolvedLocation?: TrustedResolvedLocation;
}

export interface LocationGateResult {
  status: LocationGateStatus;
  conflictLevel: LocationConflictLevel;
  verifiedHierarchy: LocationLevel[];
  missingHierarchy: LocationLevel[];
  reasonCodes: string[];
  humanReadableReason: string;
  evidenceIdsUsed: string[];
}

const clean = (v?: string) => (v || "").trim().toLocaleLowerCase("en-IN").replace(/[._,-]+/g, " ").replace(/\s+/g, " ");
const same = (a?: string,b?: string) => !!clean(a) && clean(a) === clean(b);
const has = (v?: string) => !!clean(v);

export function verifyLocation(input: LocationGateInput): LocationGateResult {
  const src = input.sourceLocation || {};
  const resolved = input.trustedResolvedLocation;
  const evidenceIds = Array.from(new Set([...(input.sourceEvidenceIds || []), ...(resolved?.evidenceId ? [resolved.evidenceId] : [])]));
  const reasonCodes: string[] = [];
  const verified: LocationLevel[] = [];

  // Search scope is never copied into source facts. It is used only as an eligibility boundary:
  // a candidate proven to be outside the requested state/district is blocked, never relabelled.
  const scope=input.searchScope;
  if(scope){
    if(has(scope.state)&&has(src.state)&&!same(scope.state,src.state)) reasonCodes.push("TARGET_STATE_MISMATCH");
    else if(has(scope.district)&&has(src.district)&&!same(scope.district,src.district)) reasonCodes.push("TARGET_DISTRICT_MISMATCH");
    if(reasonCodes.length) return {status:"LOCATION_CONFLICT",conflictLevel:"HARD",verifiedHierarchy:[],missingHierarchy:(["state","district","taluka","village"] as LocationLevel[]).filter(level=>!has(src[level])),reasonCodes,humanReadableReason:"Source evidence places this property outside the requested search geography. The source location was preserved and the lead was blocked.",evidenceIdsUsed:evidenceIds};
  }
  if (resolved) {
    if (has(src.state) && has(resolved.state) && !same(src.state,resolved.state)) reasonCodes.push("STATE_CONFLICT");
    if (has(src.district) && has(resolved.district) && !same(src.district,resolved.district)) reasonCodes.push("DISTRICT_CONFLICT");
    if (reasonCodes.length) return {
      status:"LOCATION_CONFLICT", conflictLevel:"HARD", verifiedHierarchy:[],
      missingHierarchy:["state","district","taluka","village"].filter(x=>!has(src[x as keyof LocationHierarchy])) as LocationLevel[],
      reasonCodes, humanReadableReason:"Source location conflicts with trusted resolved geography. This lead is blocked.", evidenceIdsUsed:evidenceIds
    };
  }

  if (has(src.country)) verified.push("country");
  if (has(src.state)) verified.push("state");
  if (has(src.district)) verified.push("district");

  let softMismatch = false;
  if (resolved) {
    if (has(src.taluka) && has(resolved.taluka)) {
      if (same(src.taluka,resolved.taluka)) verified.push("taluka"); else { softMismatch=true; reasonCodes.push("TALUKA_REVIEW"); }
    } else if (has(src.taluka)) verified.push("taluka");
    if (has(src.village) && has(resolved.village)) {
      if (same(src.village,resolved.village)) verified.push("village"); else { softMismatch=true; reasonCodes.push("VILLAGE_REVIEW"); }
    } else if (has(src.village)) verified.push("village");
  } else {
    if (has(src.taluka)) verified.push("taluka");
    if (has(src.village)) verified.push("village");
  }

  const missing = (["state","district","taluka","village"] as LocationLevel[]).filter(level=>!has(src[level]));
  if (!has(src.state) || !has(src.district) || (!has(src.taluka) && !has(src.village))) {
    reasonCodes.push("INSUFFICIENT_SOURCE_LOCATION");
    return {status:"UNVERIFIED", conflictLevel:"NONE", verifiedHierarchy:verified, missingHierarchy:missing, reasonCodes,
      humanReadableReason:"Source evidence does not establish enough property geography. Search scope was not used to fill missing fields.", evidenceIdsUsed:evidenceIds};
  }
  if (softMismatch) return {status:"NEEDS_REVIEW", conflictLevel:"SOFT", verifiedHierarchy:verified, missingHierarchy:missing, reasonCodes,
    humanReadableReason:"Higher-level geography is consistent, but taluka/village wording needs human review.", evidenceIdsUsed:evidenceIds};

  reasonCodes.push("SOURCE_LOCATION_ESTABLISHED");
  return {status:"VERIFIED", conflictLevel:"NONE", verifiedHierarchy:verified, missingHierarchy:missing, reasonCodes,
    humanReadableReason:"Property geography is established from source evidence; search scope was not used as evidence.", evidenceIdsUsed:evidenceIds};
}

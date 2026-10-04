export type Plan = "BASIC" | "ADVANCED" | "PRO";

export type Feature =
  | "map_intelligence"
  | "portfolio_compare"
  | "professional_report"
  | "portfolio_csv"
  | "advanced_decision";

export const PLAN_META: Record<Plan, { name: string; tagline: string }> = {
  BASIC: {
    name: "Basic",
    tagline: "Capture and organise field visits",
  },
  ADVANCED: {
    name: "Advanced",
    tagline: "Add map and decision intelligence",
  },
  PRO: {
    name: "Pro",
    tagline: "Full evaluation and comparison workflow",
  },
};

/*
 * Permanent PRO deployment mode.
 *
 * This build intentionally bypasses all commercial entitlement checks.
 * Supabase, environment variables, sessions, LocalStorage and server
 * entitlements are not required for PRO access.
 */
const FORCE_PRO = true;

const ALL_FEATURES: Feature[] = [
  "map_intelligence",
  "portfolio_compare",
  "professional_report",
  "portfolio_csv",
  "advanced_decision",
];

function emitPlanChange() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("plot-scout-plan-change", {
      detail: { plan: "PRO" as Plan },
    }),
  );
}

export function getPlan(): Plan {
  return FORCE_PRO ? "PRO" : "BASIC";
}

export function isDeveloperPlanPreview(): boolean {
  return false;
}

export function setPlan(_plan: Plan): void {
  if (FORCE_PRO) emitPlanChange();
}

export function canUse(_plan: Plan, feature: Feature): boolean {
  return FORCE_PRO && ALL_FEATURES.includes(feature);
}

export function requiredPlan(_feature: Feature): Plan {
  return "PRO";
}

export async function syncTrustedEntitlements(): Promise<Plan> {
  if (FORCE_PRO) {
    emitPlanChange();
    return "PRO";
  }

  return "BASIC";
}

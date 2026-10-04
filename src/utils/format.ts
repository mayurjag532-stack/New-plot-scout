import type { PropertyRecord } from "../types";
import { economics } from "./economics";

/** Compact Indian money for headlines — presentation only, never alters stored values. */
export function fmtMoney(n: number | null | undefined): string | null {
  if (n == null) return null;
  const v = Math.round(n);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v % 1e7 === 0 ? 0 : 2).replace(/\.00$/, "")} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 === 0 ? 0 : 1).replace(/\.0$/, "")} L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${v.toLocaleString("en-IN")}`;
}

/** Full-precision rupees for places that need exact figures (compare, economics). */
export function fmtRupees(n: number | null | undefined): string | null {
  return n == null ? null : `₹${Math.round(n).toLocaleString("en-IN")}`;
}

type Eco = ReturnType<typeof economics>;
export function areaLabel(e: Eco): string | null {
  return e.areaGuntha ? `${Number(e.areaGuntha.toFixed(2)).toLocaleString("en-IN")} guntha`
    : e.areaSqft ? `${Math.round(e.areaSqft).toLocaleString("en-IN")} sq ft`
    : e.areaAcre ? `${Number(e.areaAcre.toFixed(2))} acre` : null;
}

export function relativeTime(ts: number): string {
  const s = Math.max(0, Date.now() - ts) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "Pirangut · Mulshi · Gat 112/3" — only the parts that exist. */
export function identityLine(p: PropertyRecord): string {
  const id = p.identity;
  if (!id) return "";
  const parts = [id.village, id.taluka, id.gatNo ? `Gat ${id.gatNo}` : id.surveyNo ? `Survey ${id.surveyNo}` : ""].map((x) => (x || "").trim()).filter(Boolean);
  return parts.join(" · ");
}

import { MapIntel, MapPoi, emptyMapIntel } from "../types";
import { distanceMeters } from "./geo";

// Map Intelligence is deliberately read-only. The proxy is tried first because
// browser CORS/rate-limits are the least predictable part of public Overpass.
// Direct mirrors remain fallbacks so local/offline development and deployments
// are not tied to one provider.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter"
];
const PROXY_ENDPOINT = "/api/overpass-proxy";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
interface OverpassResponse { elements: OverpassElement[]; remark?: string; }
type MapIntelErrorKind = "timeout" | "network" | "http" | "invalid" | "cancelled";
class MapIntelError extends Error {
  kind: MapIntelErrorKind;
  status?: number;
  constructor(kind: MapIntelErrorKind, message: string, status?: number) { super(message); this.kind = kind; this.status = status; this.name = "MapIntelError"; }
}

const MAJOR_HIGHWAY_TYPES = new Set(["motorway", "trunk", "primary"]);
const MAJOR_ROAD_TYPES = new Set(["motorway", "trunk", "primary", "secondary"]);
const ROAD_TYPES = ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "service"];
const POI_RADIUS_CAP = 600;

function buildRoadQuery(lat: number, lng: number, radius: number): string {
  const r = Math.min(radius, 1200);
  return `[out:json][timeout:10];way(around:${r},${lat},${lng})[highway];out center tags;`;
}
function buildPoiQuery(lat: number, lng: number, radius: number): string {
  const r = Math.min(radius, POI_RADIUS_CAP);
  return `[out:json][timeout:10];(
  nwr(around:${r},${lat},${lng})[amenity~"^(school|college|parking|fuel|restaurant|cafe)$"];
  nwr(around:${r},${lat},${lng})[leisure~"^(fitness_centre|sports_centre|pitch|stadium)$"];
  nwr(around:${r},${lat},${lng})[landuse=residential];
  nwr(around:${r},${lat},${lng})[place~"^(residential|neighbourhood|suburb)$"];
  nwr(around:${r},${lat},${lng})[shop];
  nwr(around:${r},${lat},${lng})[amenity=bus_station];
  nwr(around:${r},${lat},${lng})[public_transport~"^(station|platform|stop_position)$"];
  nwr(around:${r},${lat},${lng})[railway~"^(station|halt|tram_stop|subway_entrance)$"];
  nwr(around:${r},${lat},${lng})[tourism~"^(attraction|museum|viewpoint|gallery)$"];
  nwr(around:${r},${lat},${lng})[historic];
);out center tags;`;
}

// The proxy hedges across mirrors for up to ~10s, so it gets a longer attempt window than
// the direct fallbacks. TOTAL_BUDGET_MS is the absolute client-side deadline.
const PROXY_ATTEMPT_TIMEOUT_MS = 11_000;
const ATTEMPT_TIMEOUT_MS = 5_500;
const TOTAL_BUDGET_MS = 12_500;
const CACHE_MAX_ENTRIES = 12;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_PREFIX = "plot-scout:map-intel:v2:";
function cacheKey(lat: number, lng: number, radius: number) { return `${CACHE_PREFIX}${lat.toFixed(4)}:${lng.toFixed(4)}:${Math.round(radius / 100) * 100}`; }
function readCache(key: string): MapIntel | null {
  try {
    const raw = localStorage.getItem(key); if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; intel: MapIntel };
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
    return parsed.intel;
  } catch { return null; }
}
function pruneCache() {
  try {
    const entries: { k: string; t: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(CACHE_PREFIX)) continue;
      let t = 0; try { t = (JSON.parse(localStorage.getItem(k) || "{}") as { savedAt?: number }).savedAt ?? 0; } catch {}
      entries.push({ k, t });
    }
    entries.sort((a, b) => b.t - a.t).slice(CACHE_MAX_ENTRIES).forEach(e => localStorage.removeItem(e.k));
  } catch {}
}
function writeCache(key: string, intel: MapIntel) { try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), intel })); pruneCache(); } catch {} }
function devLog(endpoint: string, outcome: string) { if (import.meta.env.DEV) console.debug(`[map-intel] ${endpoint} -> ${outcome}`); }

async function attempt(url: string, query: string, timeoutMs: number, externalSignal?: AbortSignal): Promise<OverpassResponse> {
  if (externalSignal?.aborted) throw new MapIntelError("cancelled", "Map analysis cancelled");
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abort = () => controller.abort();
  externalSignal?.addEventListener("abort", abort, { once: true });
  try {
    const isProxy = url === PROXY_ENDPOINT;
    const init: RequestInit = isProxy
      ? { method: "POST", body: `data=${encodeURIComponent(query)}`, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: controller.signal }
      : { method: "POST", body: `data=${encodeURIComponent(query)}`, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: controller.signal };
    let res: Response;
    try {
      res = await fetch(url, init);
      if (!res.ok && !isProxy && url.startsWith("https://")) {
        res = await fetch(`${url}?data=${encodeURIComponent(query)}`, { method: "GET", signal: controller.signal });
      }
    } catch (e) {
      if (externalSignal?.aborted) throw new MapIntelError("cancelled", "Map analysis cancelled");
      if (timedOut) throw new MapIntelError("timeout", "Map service timeout");
      throw new MapIntelError("network", e instanceof Error ? e.message : "Map request failed");
    }
    if (!res.ok) throw new MapIntelError("http", `Map service returned ${res.status}`, res.status);
    const data = (await res.json()) as OverpassResponse;
    if (!data || !Array.isArray(data.elements)) throw new MapIntelError("invalid", "Invalid map response");
    if (typeof data.remark === "string" && /runtime error|out of memory|timed out/i.test(data.remark)) throw new MapIntelError("http", "Incomplete map response", 200);
    return data;
  } catch (e) {
    if (e instanceof MapIntelError) throw e;
    throw new MapIntelError("invalid", "Map response could not be read");
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  }
}

async function runSingleQuery(query: string, externalSignal?: AbortSignal): Promise<OverpassResponse> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new MapIntelError("network", "offline");
  const started = Date.now();
  const targets = [PROXY_ENDPOINT, ...OVERPASS_ENDPOINTS];
  let last: MapIntelError | null = null;
  for (const url of targets) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < 1200) break;
    try {
      const data = await attempt(url, query, Math.min(url === PROXY_ENDPOINT ? PROXY_ATTEMPT_TIMEOUT_MS : ATTEMPT_TIMEOUT_MS, remaining), externalSignal);
      devLog(url, `ok (${data.elements.length})`);
      return data;
    } catch (e) {
      const err = e instanceof MapIntelError ? e : new MapIntelError("network", "Request failed");
      if (err.kind === "cancelled") throw err;
      last = err; devLog(url, err.kind);
    }
  }
  throw last ?? new MapIntelError("network", "No map service available");
}

function elementLatLng(el: OverpassElement) { if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lng: el.lon }; if (el.center) return { lat: el.center.lat, lng: el.center.lon }; return null; }
function toPoi(el: OverpassElement, lat: number, lng: number, category: string, name: string): MapPoi | null {
  const pos = elementLatLng(el); if (!pos) return null;
  return { id: `${el.type}/${el.id}`, name, category, lat: pos.lat, lng: pos.lng, distanceMeters: distanceMeters(lat, lng, pos.lat, pos.lng), roadType: el.tags?.highway, source: "OpenStreetMap", confidence: el.tags?.name ? "high" : "medium" };
}
function cleanPois(items: MapPoi[]): MapPoi[] {
  const out: MapPoi[] = [];
  for (const poi of items) {
    if (/^Unnamed location$/i.test(poi.name.trim())) continue;
    const key = poi.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!out.some(x => key === x.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() && Math.abs(x.distanceMeters - poi.distanceMeters) < 80)) out.push(poi);
  }
  return out;
}

function applyElements(intel: MapIntel, elements: OverpassElement[], lat: number, lng: number) {
  const roads: MapPoi[] = [], residential: MapPoi[] = [], sports: MapPoi[] = [], education: MapPoi[] = [], access: MapPoi[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name || tags["addr:street"] || (tags.highway ? `Unnamed ${tags.highway.replace(/_/g, " ")} road` : "Unnamed location");
    if (tags.highway && ROAD_TYPES.includes(tags.highway)) { const p = toPoi(el, lat, lng, "road", name); if (p) roads.push(p); continue; }
    if (tags.amenity === "school" || tags.amenity === "college") { const p = toPoi(el, lat, lng, "education", name); if (p) education.push(p); continue; }
    if (["fitness_centre", "sports_centre", "pitch", "stadium"].includes(tags.leisure) || tags.sport === "badminton" || tags.sport === "pickleball") { const p = toPoi(el, lat, lng, "sports", name || "Sports facility"); if (p) sports.push(p); continue; }
    if (tags.landuse === "residential" || tags.place === "residential" || tags.place === "neighbourhood" || tags.place === "suburb") { const p = toPoi(el, lat, lng, "residential", name); if (p) residential.push(p); continue; }
    if (tags.amenity || tags.shop || tags.tourism || tags.historic || tags.railway || tags.public_transport) {
      const cat = tags.amenity === "parking" ? "Parking" : tags.amenity === "fuel" ? "Petrol pump" : tags.amenity === "restaurant" ? "Restaurant" : tags.amenity === "cafe" ? "Cafe" : tags.railway ? "Train station" : tags.public_transport || tags.amenity === "bus_station" ? "Public transport" : tags.tourism || tags.historic ? "Landmark / point of interest" : "Shop / commercial";
      const p = toPoi(el, lat, lng, "access", name || cat); if (p) access.push({ ...p, category: cat });
    }
  }
  roads.sort((a,b)=>a.distanceMeters-b.distanceMeters); residential.sort((a,b)=>a.distanceMeters-b.distanceMeters); sports.sort((a,b)=>a.distanceMeters-b.distanceMeters); education.sort((a,b)=>a.distanceMeters-b.distanceMeters); access.sort((a,b)=>a.distanceMeters-b.distanceMeters);
  intel.nearestRoad = roads[0] ?? intel.nearestRoad;
  intel.nearestMajorRoad = roads.find(r => r.roadType && MAJOR_ROAD_TYPES.has(r.roadType)) ?? intel.nearestMajorRoad;
  intel.nearestHighway = roads.find(r => r.roadType && MAJOR_HIGHWAY_TYPES.has(r.roadType)) ?? intel.nearestHighway;
  intel.residential = cleanPois([...intel.residential, ...residential]).sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,15);
  intel.sports = cleanPois([...intel.sports, ...sports]).sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,15);
  intel.education = cleanPois([...intel.education, ...education]).sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,15);
  intel.access = cleanPois([...intel.access, ...access]).sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,20);
}

export async function fetchMapIntel(lat: number, lng: number, radius: number, signal?: AbortSignal, forceRefresh = false): Promise<MapIntel> {
  const key = cacheKey(lat, lng, radius);
  if (!forceRefresh) { const cached = readCache(key); if (cached) return cached; }
  const intel = emptyMapIntel(); intel.radiusMeters = radius; intel.status = "loading";
  try {
    const [roadsResult, poiResult] = await Promise.allSettled([
      runSingleQuery(buildRoadQuery(lat, lng, radius), signal),
      runSingleQuery(buildPoiQuery(lat, lng, radius), signal)
    ]);
    if (signal?.aborted) throw new MapIntelError("cancelled", "Map analysis cancelled");
    const successes = [roadsResult, poiResult].filter((x): x is PromiseFulfilledResult<OverpassResponse> => x.status === "fulfilled");
    if (!successes.length) {
      const reason = roadsResult.status === "rejected" ? roadsResult.reason : poiResult.status === "rejected" ? poiResult.reason : null;
      throw (reason instanceof MapIntelError ? reason : new MapIntelError("network", "No map service available"));
    }
    for (const result of successes) applyElements(intel, result.value.elements, lat, lng);
    intel.status = successes.length === 2 ? "ok" : "partial";
    intel.fetchedAt = Date.now();
    writeCache(key, intel);
    return intel;
  } catch (err) {
    if (err instanceof MapIntelError && err.kind === "cancelled") { intel.status = "not_run"; return intel; }
    // Never block on a failed refresh: reuse a still-valid cached result if one exists.
    const fallback = readCache(key);
    if (fallback) return fallback;
    intel.status = "failed";
    intel.errorMessage = describeMapIntelError(err);
    return intel;
  }
}

function describeMapIntelError(err: unknown): string {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (err instanceof MapIntelError) {
    if (err.kind === "timeout") return "Result not found right now — the map service took too long to respond. Your saved location is safe.";
    if (err.kind === "http") return "Result not found right now — the free map service is busy. Your saved location is safe.";
    if (err.kind === "network") return offline ? "Result not found — you appear to be offline. Your saved location is safe." : "Result not found right now — no map service responded. Your saved location is safe.";
    if (err.kind === "invalid") return "Result not found — the map service returned unreadable data. Your saved location is safe.";
  }
  return "Result not found right now. Your saved location and saved field evidence are safe.";
}

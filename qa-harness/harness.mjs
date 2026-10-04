// QA harness. Fixtures are QA-ONLY (seeded into a throwaway browser profile), never shipped.
// Map tiles are synthetic stand-ins because CARTO/Esri are unreachable from this sandbox.
import { chromium } from "/home/claude/work/app/land-scout-pro-main/node_modules/playwright-core/index.mjs";
import fs from "fs";
const DIR = "/tmp/claude-0/-home-claude/4a6401b5-1112-509e-9c53-ef347ea98d77/scratchpad/qa";
export const BASE = process.env.BASE || "http://localhost:5173";
const tiles = { sat: fs.readFileSync(`${DIR}/sat.png`), light: fs.readFileSync(`${DIR}/light.png`), dark: fs.readFileSync(`${DIR}/dark.png`) };

const FIX = [
  { n: "QA Fixture · Mulshi Hillside", lat: 18.5183, lng: 73.5120, q: 4200000, a: 6500000, g: 12, road: 24, rd: 350, score: "strong" },
  { n: "QA Fixture · Hinjewadi Corner", lat: 18.5912, lng: 73.7389, q: 9800000, a: 10500000, g: 6, road: 40, rd: 120, score: "mid" },
  { n: "QA Fixture · Wagholi Plot 14", lat: 18.5805, lng: 73.9811, q: 2650000, a: 2900000, g: 4, road: 18, rd: 700, score: "weak" },
  { n: "QA Fixture · Bhor Road Parcel", lat: 18.1496, lng: 73.8442, q: null, a: null, g: null, road: null, rd: null, score: "none" },
  { n: "QA Fixture · Lonavala Ridge", lat: 18.7546, lng: 73.4062, q: 15200000, a: 16000000, g: 20, road: 30, rd: 90, score: "strong" },
];

function mk(f, i) {
  const now = Date.now() - i * 86400000 * 2;
  const intel = f.score === "none" ? { status: "not_run", fetchedAt: null, radiusMeters: 1500, nearestRoad: null, nearestMajorRoad: null, nearestHighway: null, residential: [], sports: [], education: [], access: [], errorMessage: null }
    : { status: "ok", fetchedAt: now, radiusMeters: 1500, nearestRoad: { id: "r1", name: "Local road", category: "road", lat: f.lat, lng: f.lng, distanceMeters: 60, source: "OpenStreetMap" }, nearestMajorRoad: { id: "r2", name: "State road", category: "road", lat: f.lat, lng: f.lng, distanceMeters: f.rd, source: "OpenStreetMap" }, nearestHighway: null, residential: [], sports: [], education: [], access: [], errorMessage: null };
  const checklist = {};
  if (f.score === "strong") ["main_road_practical", "approach_car_friendly", "land_flat", "no_waterlogging", "electricity_accessible", "water_available"].forEach((k) => (checklist[k] = true));
  if (f.score === "mid") { checklist.approach_car_friendly = true; checklist.land_flat = true; checklist.no_waterlogging = false; }
  if (f.score === "weak") { checklist.approach_car_friendly = false; checklist.no_nala_issue = false; }
  return {
    id: `qa_${i}`, name: f.n, createdAt: now, updatedAt: now,
    location: { lat: f.lat, lng: f.lng, accuracy: 12, timestamp: now, source: "gps" },
    mapIntel: intel, checklist,
    ownerAnswers: f.score === "strong" ? { q_own_property: "Yes", q_712_papers: "Yes" } : {},
    price: { quotedPrice: f.q, askingPrice: f.a, negotiatedPrice: null, additionalCosts: null, areaSqft: null, areaGuntha: f.g, areaAcre: null, roadWidthFt: f.road, mainRoadDistanceM: f.rd },
    notes: { site: f.score === "strong" ? "Gentle slope, access from the village road." : "", owner: "", general: "" },
    photos: [], finalStatus: "UNDECIDED", followUp: "",
    identity: { state: "Maharashtra", district: "Pune", taluka: "Mulshi", village: i < 2 ? "Pirangut" : "", gatNo: i < 2 ? "112/3" : "", surveyNo: "", hissaNo: "", plotNo: "", ownerName: "", brokerName: "", contact: "", sourceReference: "", provenance: "USER_ENTERED" },
    parcelIntel: { status: "not_checked", checkedAt: null, parcelLat: null, parcelLng: null, locationSource: null, officialSource: "MAHABHUMI", mismatchMeters: null, mismatchAssessment: "CANNOT_DETERMINE" },
  };
}

export async function launch({ w = 390, h = 844, dark = false, seed = true, offline = false, tilesMode = "stub", plan } = {}) {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: dark ? "dark" : "light", geolocation: { latitude: 18.52, longitude: 73.85 }, permissions: ["geolocation"], isMobile: w < 700, hasTouch: w < 700 });
  await ctx.route(/(cartocdn|arcgisonline|openstreetmap)/, (route) => {
    if (tilesMode === "block") return route.abort();
    const u = route.request().url();
    const b = /arcgis/.test(u) ? tiles.sat : /dark_all/.test(u) ? tiles.dark : tiles.light;
    route.fulfill({ status: 200, contentType: "image/png", body: b });
  });
  const FD = `${DIR}/node_modules/@fontsource-variable`;
  await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: `@font-face{font-family:Fraunces;font-weight:100 900;src:url(https://qa-fonts.local/fr.woff2) format("woff2")}@font-face{font-family:Inter;font-weight:100 900;src:url(https://qa-fonts.local/in.woff2) format("woff2")}` }));
  await ctx.route(/qa-fonts\.local/, (r) => r.fulfill({ status: 200, contentType: "font/woff2", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(/fr\.woff2/.test(r.request().url()) ? `${FD}/fraunces/files/fraunces-latin-wght-normal.woff2` : `${FD}/inter/files/inter-latin-wght-normal.woff2`) }));
  await ctx.route(/fonts\.gstatic/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: "networkidle" });
  if (seed) {
    await page.evaluate(async (recs) => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open("land-scout-pro"); r.onsuccess = () => res(r.result); r.onerror = rej; });
      // gradient photos for the first two fixtures (QA placeholders)
      const mkPhoto = (hue) => new Promise((res) => { const c = document.createElement("canvas"); c.width = 640; c.height = 440; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 440); g.addColorStop(0, `hsl(${hue},25%,72%)`); g.addColorStop(1, `hsl(${hue + 20},30%,38%)`); x.fillStyle = g; x.fillRect(0, 0, 640, 440); c.toBlob(res, "image/jpeg", 0.8); });
      const photos = [];
      for (let i = 0; i < 2; i++) for (const [k, cat] of [[0, "front_road"], [1, "plot"], [2, "surrounding"]]) photos.push({ id: `qa_ph_${i}_${k}`, propertyId: recs[i].id, category: cat, blob: await mkPhoto(90 + i * 30 + k * 12), addedAt: Date.now() - k * 3600000, caption: k === 0 ? "QA placeholder" : undefined });
      const tx = db.transaction(["properties", "photos"], "readwrite");
      recs.forEach((r) => tx.objectStore("properties").put(r));
      photos.forEach((ph) => tx.objectStore("photos").put(ph));
      await new Promise((r) => (tx.oncomplete = r));
    }, FIX.map(mk));
    await page.reload({ waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
  }
  if (offline) await ctx.setOffline(true);
  return { browser, ctx, page, errors, shot: async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${DIR}/shots/${name}.png` }); } };
}
fs.mkdirSync(`${DIR}/shots`, { recursive: true });

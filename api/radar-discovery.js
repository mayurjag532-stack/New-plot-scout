function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function text(v) {
  return String(v ?? "").trim();
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const k = keyFn(item);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function classifyOsm(tags = {}) {
  const saleWords = [
    "sale", "for sale", "sell", "plot for sale",
    "land for sale", "property for sale"
  ];

  const haystack = Object.values(tags)
    .map(v => String(v || "").toLowerCase())
    .join(" ");

  const saleIntent = saleWords.some(w => haystack.includes(w));

  let candidateType = "context_location";

  if (tags.landuse === "residential") candidateType = "residential_area";
  else if (tags.landuse === "commercial") candidateType = "commercial_area";
  else if (tags.landuse === "industrial") candidateType = "industrial_area";
  else if (tags.place) candidateType = "place_context";

  return {
    candidateType,
    saleIntent,
    evidenceClass: saleIntent ? "sale_signal" : "context_only"
  };
}

async function fetchOverpass({ lat, lon, radiusKm }) {
  const radius = Math.round(radiusKm * 1000);

  const query = `
[out:json][timeout:22];
(
  nwr(around:${radius},${lat},${lon})["landuse"~"residential|commercial|industrial"];
  nwr(around:${radius},${lat},${lon})["place"~"village|town|suburb|neighbourhood"];
  nwr(around:${radius},${lat},${lon})["residential"];
);
out center tags 80;
`;

  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "PlotScout/1.1"
    },
    body: new URLSearchParams({ data: query })
  });

  if (!r.ok) {
    throw new Error(`OpenStreetMap discovery returned ${r.status}`);
  }

  const data = await r.json();

  return (data.elements || [])
    .filter(x => x?.tags)
    .map(x => {
      const candidateLat = num(x.lat ?? x.center?.lat);
      const candidateLon = num(x.lon ?? x.center?.lon);

      if (candidateLat === null || candidateLon === null) return null;

      const classification = classifyOsm(x.tags);

      return {
        providerId: "openstreetmap-overpass",
        providerName: "OpenStreetMap / Overpass",

        externalId: `${x.type}/${x.id}`,
        sourceUrl: `https://www.openstreetmap.org/${x.type}/${x.id}`,

        capturedAt: Date.now(),

        rawTitle:
          text(x.tags.name) ||
          text(x.tags["name:en"]) ||
          text(x.tags.place) ||
          text(x.tags.landuse) ||
          "Mapped land/location candidate",

        rawText: [
          x.tags.name,
          x.tags.place,
          x.tags.landuse,
          x.tags.description
        ].filter(Boolean).join(" · "),

        lat: candidateLat,
        lon: candidateLon,

        distanceKm:
          Math.round(haversineKm(lat, lon, candidateLat, candidateLon) * 100) / 100,

        candidateType: classification.candidateType,
        evidenceClass: classification.evidenceClass,
        saleIntent: classification.saleIntent,

        verificationState: "UNVERIFIED",

        confidence:
          classification.saleIntent ? 0.45 : 0.20,

        provenance: {
          sourceType: "public_map_data",
          sourceName: "OpenStreetMap",
          capturedAt: Date.now(),
          propertySaleProof: classification.saleIntent
        },

        rawPayload: {
          id: x.id,
          type: x.type,
          lat: candidateLat,
          lon: candidateLon,
          tags: x.tags
        }
      };
    })
    .filter(Boolean);
}

const PROVIDERS = [
  {
    id: "openstreetmap-overpass",
    type: "context",
    enabled: true,
    run: fetchOverpass
  }

  /*
    NEXT PROVIDERS WILL PLUG IN HERE:

    - compliant property listing feeds/APIs
    - public government/open-data sources
    - permitted classifieds feeds
    - public developer/project sources
    - user-shared property links
    - permitted social/public web sources

    Google / Instagram scraping is intentionally NOT done here.
    Those require compliant API/public-access adapters.
  */
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const scope = req.body || {};

    const lat = num(scope.lat);
    const lon = num(scope.lon);

    const radiusKm = Math.min(
      Math.max(
        Number(scope.radiusKm ?? scope.radiuskm) || 15,
        2
      ),
      100
    );

    if (lat === null || lon === null) {
      return res.status(400).json({
        error: "Verified GPS coordinates required"
      });
    }

    const providerResults = await Promise.allSettled(
      PROVIDERS
        .filter(p => p.enabled)
        .map(async provider => {
          const results = await provider.run({
            lat,
            lon,
            radiusKm,
            scope
          });

          return {
            providerId: provider.id,
            type: provider.type,
            results
          };
        })
    );

    const all = [];
    const providerStatus = [];

    for (const result of providerResults) {
      if (result.status === "fulfilled") {
        providerStatus.push({
          providerId: result.value.providerId,
          status: "ok",
          count: result.value.results.length
        });

        all.push(...result.value.results);
      } else {
        providerStatus.push({
          providerId: "unknown",
          status: "failed",
          error: String(result.reason?.message || result.reason)
        });
      }
    }

    const candidates = uniqBy(
      all,
      x => `${x.providerId}:${x.externalId}`
    )
      .sort((a, b) => {
        if (a.saleIntent !== b.saleIntent) {
          return Number(b.saleIntent) - Number(a.saleIntent);
        }

        return (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999);
      })
      .slice(0, 100);

    return res.status(200).json({
      candidates,

      summary: {
        total: candidates.length,
        saleSignals: candidates.filter(x => x.saleIntent).length,
        contextOnly: candidates.filter(x => !x.saleIntent).length
      },

      sort: "sale-signal-first_then_nearest",

      origin: {
        lat,
        lon
      },

      radiusKm,

      providers: providerStatus,

      generatedAt: Date.now()
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Discovery failed"
    });
  }
}

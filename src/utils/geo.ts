// Haversine straight-line distance in metres.
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function googleMapsPointUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function googleMapsSearchUrl(lat: number, lng: number, query: string): string {
  const q = encodeURIComponent(query);
  // Centers the search near the captured coordinates.
  return `https://www.google.com/maps/search/${q}/@${lat.toFixed(6)},${lng.toFixed(6)},15z`;
}

/**
 * Extracts lat/lng from a pasted Google Maps URL. Handles the common formats:
 *  - https://maps.google.com/maps?q=18.5,73.9
 *  - https://www.google.com/maps/@18.5,73.9,15z
 *  - https://www.google.com/maps/place/.../@18.5,73.9,17z
 *  - https://goo.gl/maps/... (short links cannot be resolved client-side; returns null)
 */
export function extractLatLngFromMapsUrl(url: string): { lat: number; lng: number } | null {
  try {
    const decoded = decodeURIComponent(url);

    // @lat,lng pattern
    const atMatch = decoded.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if (atMatch) {
      return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    // q=lat,lng or query=lat,lng pattern
    const qMatch = decoded.match(/[?&](?:q|query)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if (qMatch) {
      return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    }

    // !3dLAT!4dLNG pattern used in some place URLs
    const bangMatch = decoded.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
    if (bangMatch) {
      return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) };
    }

    // Bare "lat,lng" pasted directly
    const bareMatch = decoded.trim().match(/^(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)$/);
    if (bareMatch) {
      return { lat: parseFloat(bareMatch[1]), lng: parseFloat(bareMatch[2]) };
    }

    return null;
  } catch {
    return null;
  }
}

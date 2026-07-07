// Lightweight geocoding + routing + route-corridor matching.
// - geocode: free-text → coordinates (Photon / OpenStreetMap, biased to Vadodara)
// - routeBetween: shortest driving route polyline (OSRM public server)
// - corridorMatch: is a pickup→drop pair within a route's 500m corridor, in order?

export interface LatLng {
  lat: number;
  lng: number;
}

/** [lng, lat] pairs — matches OSRM/GeoJSON ordering. */
export type Polyline = [number, number][];

const BIAS = { lat: 22.3072, lon: 73.1812 }; // Vadodara

/** Free text → best matching coordinate in India (null if not found). */
export async function geocode(query: string): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&lat=${BIAS.lat}&lon=${BIAS.lon}&bbox=68,6,98,38&limit=1&lang=en`;
  const res = await fetch(url);
  const data = await res.json();
  const f = data.features?.[0];
  if (!f?.geometry?.coordinates) return null;
  const [lng, lat] = f.geometry.coordinates;
  return { lat, lng };
}

/** Coordinates → a precise, human-readable address (null if not found). */
export async function reverseGeocode({ lat, lng }: LatLng): Promise<string | null> {
  // Nominatim at zoom 18 resolves to street/building level for the exact point,
  // rather than snapping to the nearest named landmark.
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await res.json();
  const a = data.address;
  if (!a) return data.display_name ?? null;
  // Build "house road, neighbourhood, city" from the most specific parts available.
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const parts = [
    street || a.amenity || a.building,
    a.neighbourhood || a.suburb || a.quarter,
    a.city || a.town || a.village || a.municipality || a.county,
  ].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(", ") : data.display_name ?? null;
}

/**
 * Ask the browser for the user's current location and reverse-geocode it to a
 * readable address. Rejects if permission is denied or geolocation is unavailable.
 */
export async function detectCurrentLocation(): Promise<{
  label: string;
  coords: LatLng;
  /** Reported accuracy radius in metres (lower is better). */
  accuracy: number;
}> {
  if (!("geolocation" in navigator)) {
    throw new Error("Location is not supported by this browser.");
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied. Please allow access and try again."
              : err.code === err.TIMEOUT
                ? "Timed out getting a precise location. Try again outdoors or near a window."
                : "Could not determine your location. Try again."
          )
        ),
      // maximumAge: 0 forces a fresh fix; high accuracy enables GPS where available.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
  const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  const accuracy = pos.coords.accuracy;
  const label =
    (await reverseGeocode(coords)) ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
  return { label, coords, accuracy };
}

/** Shortest driving route between two points as a [lng,lat] polyline (null on failure). */
export async function routeBetween(a: LatLng, b: LatLng): Promise<Polyline | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  const coords = data.routes?.[0]?.geometry?.coordinates;
  return Array.isArray(coords) && coords.length > 1 ? (coords as Polyline) : null;
}

const DEG = Math.PI / 180;

/** Project lng/lat to local meters (equirectangular — fine at city scale). */
function toXY(lng: number, lat: number, lat0: number): [number, number] {
  return [lng * 111320 * Math.cos(lat0 * DEG), lat * 111320];
}

/** Distance (m) from a projected point to a segment, plus the projection's t (0–1). */
function projectToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { dist: number; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return { dist: Math.hypot(p[0] - a[0], p[1] - a[1]), t: 0 };
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return { dist: Math.hypot(p[0] - cx, p[1] - cy), t };
}

/** Nearest distance (m) from a point to the route, and how far along the route that is (m). */
function nearestOnRoute(point: LatLng, route: Polyline, lat0: number) {
  const p = toXY(point.lng, point.lat, lat0);
  let best = { dist: Infinity, along: 0 };
  let cumulative = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = toXY(route[i][0], route[i][1], lat0);
    const b = toXY(route[i + 1][0], route[i + 1][1], lat0);
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const { dist, t } = projectToSegment(p, a, b);
    if (dist < best.dist) best = { dist, along: cumulative + t * segLen };
    cumulative += segLen;
  }
  return best;
}

export interface CorridorResult {
  onRoute: boolean;
  pickupDist: number; // metres pickup is off the route
  dropDist: number; // metres drop is off the route
}

/**
 * True when both pickup and drop lie within `halfWidth` metres of the route
 * AND pickup comes before drop along the route. Default 500m to each side.
 */
export function corridorMatch(
  pickup: LatLng,
  drop: LatLng,
  route: Polyline,
  halfWidth = 500
): CorridorResult {
  if (!route || route.length < 2) {
    return { onRoute: false, pickupDist: Infinity, dropDist: Infinity };
  }
  const lat0 = route[Math.floor(route.length / 2)][1];
  const pu = nearestOnRoute(pickup, route, lat0);
  const dr = nearestOnRoute(drop, route, lat0);
  const onRoute = pu.dist <= halfWidth && dr.dist <= halfWidth && pu.along < dr.along;
  return { onRoute, pickupDist: Math.round(pu.dist), dropDist: Math.round(dr.dist) };
}

/** Nearest distance (metres) from a single point to a route (Infinity if none). */
export function distanceToRoute(point: LatLng, route: Polyline): number {
  if (!route || route.length < 2) return Infinity;
  const lat0 = route[Math.floor(route.length / 2)][1];
  return nearestOnRoute(point, route, lat0).dist;
}

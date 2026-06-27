// Google Places API (New) — address autocomplete + exact place details.
// Lets users pick a real, precise location (with exact lat/lng) when publishing
// or searching for rides. Degrades gracefully to a plain text field when
// VITE_GOOGLE_MAPS_API_KEY is unset, so the app still works without a key.

import type { LatLng } from "./geo";

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/** True once VITE_GOOGLE_MAPS_API_KEY is set in .env */
export const isPlacesConfigured = Boolean(KEY);

// Bias suggestions toward Vadodara (matches the geocoding bias in geo.ts).
const BIAS = { latitude: 22.3072, longitude: 73.1812 };

export interface PlaceSuggestion {
  placeId: string;
  /** Primary line, e.g. "Vadodara Junction". */
  mainText: string;
  /** Secondary line, e.g. "Sayajigunj, Vadodara, Gujarat". */
  secondaryText: string;
  /** Full single-line description. */
  description: string;
}

/**
 * An opaque token that groups a user's autocomplete keystrokes plus the final
 * Place Details call into ONE billable session (cheaper). Start a fresh token
 * after every selection.
 */
export function newSessionToken(): string {
  return crypto.randomUUID();
}

/** Live address suggestions for the typed text (empty array when unconfigured). */
export async function placeAutocomplete(
  input: string,
  sessionToken: string
): Promise<PlaceSuggestion[]> {
  const q = input.trim();
  if (!KEY || q.length < 3) return [];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input: q,
        sessionToken,
        includedRegionCodes: ["in"],
        locationBias: { circle: { center: BIAS, radius: 50000 } },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const out: PlaceSuggestion[] = [];
    for (const s of data.suggestions ?? []) {
      const p = s.placePrediction;
      if (!p?.placeId) continue;
      out.push({
        placeId: p.placeId,
        mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
        description: p.text?.text ?? p.structuredFormat?.mainText?.text ?? "",
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Exact coordinates + formatted address for a chosen suggestion (null on failure). */
export async function placeDetails(
  placeId: string,
  sessionToken: string
): Promise<{ label: string; coords: LatLng } | null> {
  if (!KEY) return null;
  try {
    const url =
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
      `?sessionToken=${encodeURIComponent(sessionToken)}`;
    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": "formattedAddress,displayName,location",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data.location;
    if (!loc) return null;
    const label = data.formattedAddress || data.displayName?.text || "";
    return { label, coords: { lat: loc.latitude, lng: loc.longitude } };
  } catch {
    return null;
  }
}

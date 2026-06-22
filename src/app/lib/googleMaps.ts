// Loads the Google Maps JavaScript API (Places library) once, on demand.
// Falls back gracefully when no key is configured — callers should check
// `isGoogleMapsConfigured` and degrade to a plain text input.

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
  | string
  | undefined;

export const isGoogleMapsConfigured = Boolean(GOOGLE_MAPS_KEY);

let loadPromise: Promise<typeof google> | null = null;

/** Resolve once `window.google.maps.places` is ready (loads the script if needed). */
export function loadGoogleMaps(): Promise<typeof google> {
  if (!GOOGLE_MAPS_KEY) {
    return Promise.reject(new Error("Google Maps API key not configured"));
  }
  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = "__initGoogleMaps";
    (window as unknown as Record<string, unknown>)[callbackName] = () =>
      resolve(window.google);

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}` +
      `&libraries=places&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

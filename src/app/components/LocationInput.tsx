import { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import {
  loadGoogleMaps,
  isGoogleMapsConfigured,
} from "../lib/googleMaps";

// Bias predictions toward Vadodara, India (matches geo.ts).
const BIAS = { lat: 22.3072, lng: 73.1812 };

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Show the "use current location" button (typically only on the "from" field). */
  showCurrentLocation?: boolean;
  /** Extra classes for the input element. */
  className?: string;
}

export function LocationInput({
  value,
  onChange,
  placeholder = "City, address, station...",
  required,
  showCurrentLocation,
  className = "",
}: LocationInputProps) {
  const [predictions, setPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const sessionRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Warm up the Places service when a key is configured.
  useEffect(() => {
    if (!isGoogleMapsConfigured) return;
    loadGoogleMaps()
      .then((g) => {
        serviceRef.current = new g.maps.places.AutocompleteService();
        sessionRef.current = new g.maps.places.AutocompleteSessionToken();
      })
      .catch(() => {
        /* fall back to plain input */
      });
  }, []);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const fetchPredictions = (query: string) => {
    const service = serviceRef.current;
    if (!service || !query.trim()) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    service.getPlacePredictions(
      {
        input: query,
        sessionToken: sessionRef.current ?? undefined,
        componentRestrictions: { country: "in" },
        locationBias: new google.maps.Circle({
          center: BIAS,
          radius: 100_000,
        }),
      },
      (results) => {
        setPredictions(results ?? []);
        setOpen((results?.length ?? 0) > 0);
        setActiveIndex(-1);
      }
    );
  };

  const handleInput = (next: string) => {
    onChange(next);
    if (!isGoogleMapsConfigured) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(next), 250);
  };

  const selectPrediction = (
    prediction: google.maps.places.AutocompletePrediction
  ) => {
    onChange(prediction.description);
    setPredictions([]);
    setOpen(false);
    setActiveIndex(-1);
    // A session ends when a place is selected — start a fresh one.
    if (window.google?.maps?.places) {
      sessionRef.current = new google.maps.places.AutocompleteSessionToken();
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const g = await loadGoogleMaps();
          const geocoder = new g.maps.Geocoder();
          const { results } = await geocoder.geocode({
            location: { lat: latitude, lng: longitude },
          });
          onChange(
            results[0]?.formatted_address ??
              `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
          );
        } catch {
          // No Google key / reverse-geocode failed — fall back to raw coords.
          onChange(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } finally {
          setLocating(false);
          setOpen(false);
        }
      },
      (err) => {
        setLocating(false);
        alert(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please enter it manually."
            : "Could not get your location. Please enter it manually."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectPrediction(predictions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        className={`w-full pl-10 ${
          showCurrentLocation ? "pr-11" : "pr-4"
        } py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
      />

      {showCurrentLocation && (
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          title="Use my current location"
          aria-label="Use my current location"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LocateFixed className="w-5 h-5" />
          )}
        </button>
      )}

      {open && predictions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-auto">
          {predictions.map((p, i) => (
            <li key={p.place_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPrediction(p)}
                className={`w-full text-left px-4 py-2.5 flex items-start gap-2 hover:bg-muted/60 transition-colors ${
                  i === activeIndex ? "bg-muted/60" : ""
                }`}
              >
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">
                    {p.structured_formatting.main_text}
                  </span>
                  {p.structured_formatting.secondary_text && (
                    <span className="text-muted-foreground">
                      {" "}
                      {p.structured_formatting.secondary_text}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

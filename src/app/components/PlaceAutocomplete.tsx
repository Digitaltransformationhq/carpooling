import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import {
  isPlacesConfigured,
  newSessionToken,
  placeAutocomplete,
  placeDetails,
  type PlaceSuggestion,
} from "../lib/places";
import type { LatLng } from "../lib/geo";

interface PlaceAutocompleteProps {
  value: string;
  /** Fired on every text change (typing or picking a suggestion). */
  onChange: (text: string) => void;
  /** Fired only when a suggestion is picked — carries the exact coordinates. */
  onSelect?: (sel: { label: string; coords: LatLng }) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
  name?: string;
}

/**
 * A text input backed by Google Places Autocomplete. As the user types it shows
 * real address suggestions; picking one fills the field with the precise address
 * and reports its exact lat/lng via {@link onSelect}. Without an API key it
 * behaves like an ordinary text input.
 */
export function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  required,
  id,
  name,
}: PlaceAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const tokenRef = useRef<string>("");
  const boxRef = useRef<HTMLDivElement>(null);
  // Skip the fetch triggered by programmatically setting the input after a pick.
  const skipNextRef = useRef(false);

  if (!tokenRef.current) tokenRef.current = newSessionToken();

  // Debounced suggestion fetch as the user types.
  useEffect(() => {
    if (!isPlacesConfigured) return;
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await placeAutocomplete(q, tokenRef.current);
      setSuggestions(res);
      setActive(-1);
      setOpen(res.length > 0);
    }, 250);
    return () => clearTimeout(handle);
  }, [value]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = async (s: PlaceSuggestion) => {
    skipNextRef.current = true;
    // Fill with the concise name immediately; refine to "Name, City" once details load.
    onChange(s.mainText || s.description);
    setOpen(false);
    setSuggestions([]);
    const details = await placeDetails(s.placeId, tokenRef.current);
    // A selection ends the billing session — start a fresh token.
    tokenRef.current = newSessionToken();
    if (details) {
      if (details.label) {
        skipNextRef.current = true;
        onChange(details.label);
      }
      onSelect?.(details);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-72 overflow-auto">
          {suggestions.map((s, i) => (
            <li key={s.placeId}>
              <button
                type="button"
                // onMouseDown over onClick so the input's blur doesn't fire first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                className={`w-full text-left px-4 py-2.5 flex items-start gap-2 transition-colors ${
                  i === active ? "bg-accent" : "hover:bg-accent"
                }`}
              >
                <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.mainText}</span>
                  {s.secondaryText && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.secondaryText}
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

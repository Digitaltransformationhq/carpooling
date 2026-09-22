import { useState } from "react";
import { useNavigate } from "react-router";
import { MapPin, Calendar, Users, Search, LocateFixed, Loader2, Minus, Plus } from "lucide-react";
import { detectCurrentLocation, type LatLng } from "../lib/geo";
import { PlaceAutocomplete } from "./PlaceAutocomplete";
import { EventDatePicker } from "./EventDatePicker";
import { btn } from "../lib/ui";

interface SearchBarProps {
  variant?: "hero" | "compact";
}

// Rides carry at most 6 seats (see PublishRide), so searching for more than
// that could never match anything.
const MIN_PASSENGERS = 1;
const MAX_PASSENGERS = 6;

export function SearchBar({ variant = "hero" }: SearchBarProps) {
  const navigate = useNavigate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [locating, setLocating] = useState(false);
  // Exact coordinates of the picked places, so route-corridor matching uses
  // the precise point (not a re-geocode of the text label).
  const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
  const [toCoords, setToCoords] = useState<LatLng | null>(null);
  // `passengers` stays a string (it goes straight into the query string);
  // this is the clamped number the stepper reads and writes.
  const seatCount = Math.min(
    MAX_PASSENGERS,
    Math.max(MIN_PASSENGERS, Number(passengers) || MIN_PASSENGERS)
  );

  // earliest selectable date — today (local), so past dates can't be searched
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const handleDetectLocation = async () => {
    setLocating(true);
    try {
      const { label, coords, accuracy } = await detectCurrentLocation();
      setFrom(label);
      setFromCoords(coords);
      if (accuracy > 1000) {
        alert(
          `Your location was only accurate to ~${Math.round(accuracy / 1000)} km ` +
            `(this device has no GPS). Please double-check or edit the "From" field.`
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not determine your location");
    } finally {
      setLocating(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({
      from: from || "",
      to: to || "",
      date: date || "",
      passengers: passengers || "1",
    });
    if (fromCoords) {
      params.set("flat", String(fromCoords.lat));
      params.set("flng", String(fromCoords.lng));
    }
    if (toCoords) {
      params.set("tlat", String(toCoords.lat));
      params.set("tlng", String(toCoords.lng));
    }
    navigate(`/search?${params.toString()}`);
  };

  if (variant === "compact") {
    return (
      <form onSubmit={handleSearch} className="bg-card border border-primary rounded-lg shadow-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
            <PlaceAutocomplete
              placeholder="From"
              value={from}
              onChange={(t) => {
                setFrom(t);
                setFromCoords(null);
              }}
              onSelect={({ label, coords }) => {
                setFrom(label);
                setFromCoords(coords);
              }}
              className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locating}
              title="Use my current location"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary hover:bg-primary/10 rounded disabled:opacity-60"
            >
              {locating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LocateFixed className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
            <PlaceAutocomplete
              placeholder="To"
              value={to}
              onChange={(t) => {
                setTo(t);
                setToCoords(null);
              }}
              onSelect={({ label, coords }) => {
                setTo(label);
                setToCoords(coords);
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button type="submit" className={btn("primary")}>
            <Search className="w-5 h-5" />
            <span>Search</span>
          </button>
        </div>
      </form>
    );
  }

  // slick filled-field style shared across every input in the hero search card
  const field =
    "w-full py-3 px-4 text-sm bg-muted/40 border border-transparent rounded-xl " +
    "placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 " +
    "focus:ring-primary/60 focus:bg-card focus:border-transparent transition-colors";
  const labelClass =
    "text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-0.5";
  const stepperButton =
    "w-8 h-8 shrink-0 rounded-lg bg-card text-foreground ring-1 ring-black/[0.06] shadow-sm " +
    "flex items-center justify-center transition-colors hover:bg-accent " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card";

  return (
    <form
      onSubmit={handleSearch}
      className="search-glow bg-card/95 backdrop-blur-xl border border-border/60 ring-1 ring-black/5 rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.35),0_12px_24px_-10px_rgba(0,0,0,0.25)] p-5 md:p-7 max-w-4xl mx-auto"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        <div className="space-y-1.5">
          <label className={labelClass}>
            <MapPin className="w-3.5 h-3.5" />
            Leaving from
          </label>
          <div className="relative">
            <PlaceAutocomplete
              placeholder="City or address"
              value={from}
              onChange={(t) => {
                setFrom(t);
                setFromCoords(null);
              }}
              onSelect={({ label, coords }) => {
                setFrom(label);
                setFromCoords(coords);
              }}
              className={`${field} pr-10`}
              required
            />
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locating}
              title="Use my current location"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:bg-primary/10 rounded-lg disabled:opacity-60 z-10"
            >
              {locating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LocateFixed className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>
            <MapPin className="w-3.5 h-3.5" />
            Going to
          </label>
          <PlaceAutocomplete
            placeholder="City or address"
            value={to}
            onChange={setTo}
            onSelect={({ label }) => setTo(label)}
            className={field}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>
            <Calendar className="w-3.5 h-3.5" />
            Date
          </label>
          <EventDatePicker value={date} onChange={setDate} min={minDate} className={field} />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>
            <Users className="w-3.5 h-3.5" />
            Passengers
          </label>
          {/* Stepper rather than a select — one tap per seat, and it keeps the
              same 44px height as the fields beside it so the row stays even. */}
          <div className="flex items-center justify-between gap-2 w-full p-1.5 bg-muted/40 border border-transparent rounded-xl">
            <button
              type="button"
              onClick={() => setPassengers(String(Math.max(MIN_PASSENGERS, seatCount - 1)))}
              disabled={seatCount <= MIN_PASSENGERS}
              aria-label="Fewer passengers"
              className={stepperButton}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium select-none" aria-live="polite">
              {seatCount} {seatCount === 1 ? "passenger" : "passengers"}
            </span>
            <button
              type="button"
              onClick={() => setPassengers(String(Math.min(MAX_PASSENGERS, seatCount + 1)))}
              disabled={seatCount >= MAX_PASSENGERS}
              aria-label="More passengers"
              className={stepperButton}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <button type="submit" className={`${btn("primary", "lg")} w-full`}>
        <Search className="w-5 h-5" />
        <span>Search for rides</span>
      </button>
    </form>
  );
}

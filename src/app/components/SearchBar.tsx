import { useState } from "react";
import { useNavigate } from "react-router";
import { MapPin, Calendar, Users, Search, LocateFixed, Loader2, ChevronDown } from "lucide-react";
import { detectCurrentLocation } from "../lib/geo";
import { PlaceAutocomplete } from "./PlaceAutocomplete";
import { EventDatePicker } from "./EventDatePicker";

interface SearchBarProps {
  variant?: "hero" | "compact";
}

export function SearchBar({ variant = "hero" }: SearchBarProps) {
  const navigate = useNavigate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [locating, setLocating] = useState(false);

  // earliest selectable date — today (local), so past dates can't be searched
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const handleDetectLocation = async () => {
    setLocating(true);
    try {
      const { label, accuracy } = await detectCurrentLocation();
      setFrom(label);
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
              onChange={setFrom}
              onSelect={({ label }) => setFrom(label)}
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
              onChange={setTo}
              onSelect={({ label }) => setTo(label)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Search className="w-5 h-5" />
            <span>Search</span>
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSearch} className="bg-card border border-primary rounded-2xl shadow-2xl p-6 md:p-8 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Leaving from
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
            <PlaceAutocomplete
              placeholder="City, address, station..."
              value={from}
              onChange={setFrom}
              onSelect={({ label }) => setFrom(label)}
              className="w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locating}
              title="Use my current location"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary hover:bg-primary/10 rounded disabled:opacity-60 z-10"
            >
              {locating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <LocateFixed className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Going to
          </label>
          <PlaceAutocomplete
            placeholder="City, address, station..."
            value={to}
            onChange={setTo}
            onSelect={({ label }) => setTo(label)}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Date
          </label>
          <EventDatePicker
            value={date}
            onChange={setDate}
            min={minDate}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            Passengers
          </label>
          <div className="relative">
            <select
              value={passengers}
              onChange={(e) => setPassengers(e.target.value)}
              className="w-full appearance-none pl-4 pr-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="1">1 passenger</option>
              <option value="2">2 passengers</option>
              <option value="3">3 passengers</option>
              <option value="4">4+ passengers</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-primary text-primary-foreground py-4 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        <Search className="w-5 h-5" />
        <span>Search for rides</span>
      </button>
    </form>
  );
}

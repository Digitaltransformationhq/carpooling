import { useState } from "react";
import { useNavigate } from "react-router";
import { MapPin, Calendar, Users, Search } from "lucide-react";
import { LocationInput } from "./LocationInput";

interface SearchBarProps {
  variant?: "hero" | "compact";
}

export function SearchBar({ variant = "hero" }: SearchBarProps) {
  const navigate = useNavigate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState("1");

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
          <div className="flex-1">
            <LocationInput
              value={from}
              onChange={setFrom}
              placeholder="From"
              showCurrentLocation
            />
          </div>
          <div className="flex-1">
            <LocationInput value={to} onChange={setTo} placeholder="To" />
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
          <LocationInput
            value={from}
            onChange={setFrom}
            required
            showCurrentLocation
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Going to
          </label>
          <LocationInput value={to} onChange={setTo} required />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            Passengers
          </label>
          <select
            value={passengers}
            onChange={(e) => setPassengers(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="1">1 passenger</option>
            <option value="2">2 passengers</option>
            <option value="3">3 passengers</option>
            <option value="4">4+ passengers</option>
          </select>
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

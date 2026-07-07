import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { SearchBar } from "../components/SearchBar";
import { RideCard } from "../components/RideCard";
import { Ride } from "../data/mockData";
import { searchRides } from "../data/rides";

export function SearchResults() {
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const date = searchParams.get("date") || "";
  const passengers = Number(searchParams.get("passengers") || "0");
  // Precise coordinates of the picked places (from the search form), if present.
  const flat = searchParams.get("flat");
  const flng = searchParams.get("flng");
  const tlat = searchParams.get("tlat");
  const tlng = searchParams.get("tlng");
  const fromCoords = flat && flng ? { lat: Number(flat), lng: Number(flng) } : null;
  const toCoords = tlat && tlng ? { lat: Number(tlat), lng: Number(tlng) } : null;

  const [results, setResults] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    searchRides({ from, to, date, minSeats: passengers, fromCoords, toCoords })
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, date, passengers, flat, flng, tlat, tlng]);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Search Bar */}
      <div className="bg-card border-b py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SearchBar variant="hero" />
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            {from && to ? `${from} → ${to}` : "All Available Rides"}
          </h1>
          <p className="text-muted-foreground">
            {loading
              ? "Searching…"
              : `${results.length} ${results.length === 1 ? "ride" : "rides"} found`}
          </p>
        </div>

        {loading && (
          <div className="bg-card border border-primary rounded-lg p-12 text-center text-muted-foreground">
            Loading rides…
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            {results.map((ride) => (
              <RideCard key={ride.id} ride={ride} />
            ))}
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="bg-card border border-primary rounded-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">No rides found for your search criteria</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search dates</p>
          </div>
        )}
      </div>
    </div>
  );
}

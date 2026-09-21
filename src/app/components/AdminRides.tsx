import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Search,
  Trash2,
  Users,
  ChevronDown,
  ChevronRight,
  Calendar,
  Car,
  Bike,
  Phone,
  MapPin,
  Loader2,
} from "lucide-react";
import { Ride } from "../data/mockData";
import { fetchRides, fetchRideBookings, deleteRide, type RideBooking } from "../data/rides";
import { formatDate, formatTime } from "../lib/format";

type Filter = "all" | "upcoming" | "completed";

/**
 * Admin ride moderation. Reading rides was always public; removing someone
 * else's ride and reading its bookings are the two powers granted by
 * supabase/admin_permissions.sql ("rides delete admin" / "bookings read
 * admin"). Without those policies the buttons here silently no-op, so the
 * errors below surface the RLS refusal rather than swallowing it.
 */
export function AdminRides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  // ride id -> its bookings (loaded lazily when a row is expanded)
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Record<string, RideBooking[]>>({});
  const [loadingBookings, setLoadingBookings] = useState(false);

  const load = () => {
    setLoading(true);
    fetchRides()
      .then(setRides)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load rides"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isDone = (r: Ride) => Boolean(r.completed) || r.date < todayStr;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rides
      .filter((r) => (filter === "all" ? true : filter === "completed" ? isDone(r) : !isDone(r)))
      .filter((r) =>
        q
          ? `${r.from} ${r.to} ${r.driver.name}`.toLowerCase().includes(q)
          : true
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rides, query, filter, todayStr]);

  const toggle = async (rideId: string) => {
    if (expanded === rideId) {
      setExpanded(null);
      return;
    }
    setExpanded(rideId);
    if (bookings[rideId]) return; // already loaded
    setLoadingBookings(true);
    try {
      const rows = await fetchRideBookings(rideId);
      setBookings((b) => ({ ...b, [rideId]: rows }));
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not read bookings — ${e.message}`
          : "Could not read bookings"
      );
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleRemove = async (r: Ride) => {
    const label = `${r.from} → ${r.to} on ${formatDate(r.date)}`;
    if (!window.confirm(`Remove this ride?\n\n${label}\n\nThis also removes its bookings.`)) {
      return;
    }
    try {
      await deleteRide(r.id);
      setRides((list) => list.filter((x) => x.id !== r.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not remove ride");
    }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Past / completed" },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold">
          All rides <span className="text-muted-foreground font-normal">({shown.length})</span>
        </h2>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search route or driver…"
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="inline-flex items-center gap-1 bg-muted/60 border border-border rounded-full p-1 mb-5">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          {query.trim() ? "No rides match that search." : "No rides yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const done = isDone(r);
            const open = expanded === r.id;
            const rows = bookings[r.id];
            return (
              <div
                key={r.id}
                className={`bg-card border rounded-xl ${done ? "border-border" : "border-primary"}`}
              >
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {r.vehicleType === "2-wheeler" ? (
                          <Bike className="w-3.5 h-3.5" />
                        ) : (
                          <Car className="w-3.5 h-3.5" />
                        )}
                        {r.driver.name}
                      </span>
                      {done && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {r.completed ? "Completed" : "Past"}
                        </span>
                      )}
                      {r.started && !done && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          On the way
                        </span>
                      )}
                    </div>

                    <p className="font-medium truncate" title={`${r.from} → ${r.to}`}>
                      {r.from} → {r.to}
                    </p>

                    <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(r.date)} at {formatTime(r.time)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {r.bookedSeats ?? 0}/{r.seats} booked
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to={`/ride/${r.id}`}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => handleRemove(r)}
                      aria-label="Remove ride"
                      title="Remove ride"
                      className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => toggle(r.id)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-1.5 px-4 pb-3 text-sm text-primary hover:underline"
                >
                  {open ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  {open ? "Hide passengers" : "View passengers"}
                </button>

                {open && (
                  <div className="border-t border-border px-4 py-3">
                    {loadingBookings && !rows ? (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading…
                      </p>
                    ) : !rows || rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No one has requested a seat on this ride.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {rows.map((b) => (
                          <li
                            key={b.id}
                            className="flex items-start justify-between gap-3 text-sm border border-border rounded-lg p-3"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {b.passenger_name}
                                <span className="text-muted-foreground font-normal">
                                  {" · "}
                                  {b.seats} {b.seats === 1 ? "seat" : "seats"}
                                </span>
                              </p>
                              {b.pickup_label && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0 text-primary" />
                                  {b.pickup_label}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  b.status === "accepted"
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {b.status === "accepted" ? "Confirmed" : "Pending"}
                              </span>
                              {b.passenger_phone && (
                                <a
                                  href={`tel:${b.passenger_phone.replace(/[^+\d]/g, "")}`}
                                  aria-label={`Call ${b.passenger_name}`}
                                  className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

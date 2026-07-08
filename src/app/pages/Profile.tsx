import { useEffect, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router";
import { Calendar, Car, MapPin, Award, Plus, Route } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchUserStats, fetchMyTrips, type UserStats, type Trip } from "../data/account";
import { deleteRide, markRideComplete, markRideStarted } from "../data/rides";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/format";

type Filter = "all" | "upcoming" | "completed";

export function Profile() {
  const navigate = useNavigate();
  const { user: authUser, loading, configured, profile: authProfile } = useAuth();

  const [stats, setStats] = useState<UserStats>({
    ridesAsDriver: 0,
    ridesAsPassenger: 0,
    points: 0,
  });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!authUser) return;
    fetchUserStats(authUser.id).then(setStats).catch(() => {});
    fetchMyTrips(authUser.id).then(setTrips).catch(() => {});
  }, [authUser]);

  // Live: keep "My Rides" and the stats current when rides or bookings change
  // (you publish/complete/delete a ride, a request comes in, etc.).
  useEffect(() => {
    if (!supabase || !authUser) return;
    const client = supabase;
    const reload = () => {
      fetchUserStats(authUser.id).then(setStats).catch(() => {});
      fetchMyTrips(authUser.id).then(setTrips).catch(() => {});
    };
    const channel = client
      .channel(`profile-activity-${authUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, reload)
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [authUser]);

  if (configured && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (configured && !authUser) {
    return <Navigate to="/login" replace />;
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const reloadTrips = () => {
    if (authUser) fetchMyTrips(authUser.id).then(setTrips).catch(() => {});
  };

  const handleStart = async (rideId: string) => {
    try {
      await markRideStarted(rideId);
      reloadTrips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update ride");
    }
  };

  const handleComplete = async (rideId: string) => {
    try {
      await markRideComplete(rideId);
      reloadTrips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update ride");
    }
  };

  const handleRemove = async (rideId: string) => {
    if (!window.confirm("Remove this published ride?")) return;
    try {
      await deleteRide(rideId);
      reloadTrips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove ride");
    }
  };

  const isDone = (t: Trip) => t.completed || t.date < todayStr;
  const filtered = trips.filter((t) =>
    filter === "all" ? true : filter === "completed" ? isDone(t) : !isDone(t)
  );
  const upcomingCount = trips.filter((t) => !isDone(t)).length;
  const completedCount = trips.filter((t) => isDone(t)).length;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: trips.length },
    { key: "upcoming", label: "Upcoming", count: upcomingCount },
    { key: "completed", label: "Completed", count: completedCount },
  ];

  const summary = [
    { label: "As driver", value: stats.ridesAsDriver, icon: Car, accent: false },
    { label: "As passenger", value: stats.ridesAsPassenger, icon: MapPin, accent: false },
    {
      label: "Reward points",
      value: authProfile?.points ?? stats.points,
      icon: Award,
      accent: true,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Rides</h1>
            <p className="text-muted-foreground mt-1">
              Everything you've published or joined, in one place.
            </p>
          </div>
          <Link
            to="/publish"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Publish a ride
          </Link>
        </div>

        {/* Ride stat summary */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          {summary.map((s) => (
            <div
              key={s.label}
              className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center text-center"
            >
              <s.icon
                className={`w-5 h-5 mb-1.5 ${s.accent ? "text-primary" : "text-muted-foreground"}`}
              />
              <div className={`text-2xl font-bold ${s.accent ? "text-primary" : ""}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter segmented control */}
        <div className="inline-flex items-center gap-1 bg-muted/60 border border-border rounded-full p-1 mb-5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              <span className="ml-1.5 text-xs opacity-70">{f.count}</span>
            </button>
          ))}
        </div>

        {/* Rides list */}
        {filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Route className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium mb-1">
              {filter === "all" ? "No rides yet" : `No ${filter} rides`}
            </p>
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "Publish a ride or book a seat and it'll show up here."
                : "Try a different filter to see your other rides."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((trip) => {
              const isCompleted = isDone(trip);
              const isStarted = trip.started && !isCompleted;
              const statusLabel = isCompleted
                ? "Completed"
                : isStarted
                ? "On the way"
                : "Upcoming";
              const statusClass = isCompleted
                ? "bg-muted text-muted-foreground"
                : isStarted
                ? "bg-green-100 text-green-700"
                : "bg-primary/15 text-primary";
              return (
                <div
                  key={trip.key}
                  onClick={() => trip.rideId && navigate(`/ride/${trip.rideId}`)}
                  role={trip.rideId ? "button" : undefined}
                  tabIndex={trip.rideId ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (trip.rideId && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      navigate(`/ride/${trip.rideId}`);
                    }
                  }}
                  className={`bg-card border border-border rounded-2xl p-5 ${
                    trip.rideId
                      ? "cursor-pointer transition-all hover:border-primary hover:shadow-md hover:shadow-primary/10"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          trip.type === "driver"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent text-foreground"
                        }`}
                      >
                        {trip.type === "driver" ? (
                          <Car className="w-3.5 h-3.5" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                        {trip.type === "driver" ? "Driving" : "Passenger"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground flex items-center gap-1 shrink-0">
                      <Calendar className="w-4 h-4" />
                      {formatDate(trip.date)}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold truncate">{trip.from}</span>
                      <span className="w-5 h-5 rounded-[4px] bg-primary flex items-center justify-center shrink-0">
                        <span className="w-2 h-2 rounded-[1px] bg-white"></span>
                      </span>
                    </div>
                    <div
                      className={`flex-1 h-[3px] ${isCompleted ? "route-still" : "route-flow"}`}
                      aria-hidden="true"
                    ></div>
                    <div className="flex items-center gap-2 min-w-0">
                      <svg
                        viewBox="-2 -2 18 20"
                        className="w-4 h-4 text-primary shrink-0"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M0 0L14 8L0 16Z" />
                      </svg>
                      <span className="font-semibold truncate">{trip.to}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                    <p className="text-sm text-muted-foreground">{trip.detail}</p>
                    {trip.type === "driver" && trip.rideId && (
                      <div className="flex items-center gap-2">
                        {!isCompleted && !isStarted && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStart(trip.rideId!);
                            }}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-primary hover:bg-primary/10 transition-colors"
                          >
                            Start ride
                          </button>
                        )}
                        {!isCompleted && isStarted && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleComplete(trip.rideId!);
                            }}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-primary hover:bg-primary/10 transition-colors"
                          >
                            Mark complete
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(trip.rideId!);
                          }}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

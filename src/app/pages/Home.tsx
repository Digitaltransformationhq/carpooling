import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { SearchBar } from "../components/SearchBar";
import { RideCard } from "../components/RideCard";
import { Ride } from "../data/mockData";
import { fetchRecentRides } from "../data/rides";
import {
  fetchMyTrips,
  fetchIncomingRequests,
  type Trip,
  type IncomingRequest,
} from "../data/account";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../lib/format";
import { Leaf, Award, Users, BadgeCheck, Car, Gift, Search, Calendar } from "lucide-react";

export function Home() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [featuredRides, setFeaturedRides] = useState<Ride[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);

  // Post-login / deep link: scroll to "Rides Leaving Soon". Email sign-in sets
  // the URL hash; Google sign-in survives the OAuth round-trip via a one-shot
  // sessionStorage flag. Re-runs as content above loads (its position shifts).
  useEffect(() => {
    const wantScroll =
      location.hash === "#rides-leaving-soon" ||
      sessionStorage.getItem("scrollTo") === "rides-leaving-soon";
    if (!wantScroll) return;
    const el = document.getElementById("rides-leaving-soon");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      sessionStorage.removeItem("scrollTo");
    }
  }, [location.hash, loadingRides, trips, incoming]);

  useEffect(() => {
    fetchRecentRides(10)
      .then(setFeaturedRides)
      .catch(() => setFeaturedRides([]))
      .finally(() => setLoadingRides(false));
  }, []);

  // Live: refresh the list whenever any ride changes (published, completed,
  // started, deleted) so it stays current without a manual refresh.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel("home-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        fetchRecentRides(10).then(setFeaturedRides).catch(() => {});
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, []);

  // Personalized dashboard data (logged-in users), kept live.
  useEffect(() => {
    if (!user) {
      setTrips([]);
      setIncoming([]);
      return;
    }
    const load = () => {
      fetchMyTrips(user.id).then(setTrips).catch(() => {});
      fetchIncomingRequests(user.id).then(setIncoming).catch(() => {});
    };
    load();
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel(`home-me-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [user]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = trips
    .filter((t) => !t.completed && t.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const firstName =
    profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const points = profile?.points ?? 0;
  const heroSubtitle =
    points > 0
      ? `You're on a roll — ${points} point${points === 1 ? "" : "s"} and counting!`
      : "Your first ride, your first points. Let's go!";

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative bg-cover bg-bottom bg-no-repeat py-20 md:py-32 min-h-[90vh] md:min-h-screen"
        style={{ backgroundImage: `url('/hero-bg.png')`, backgroundColor: "#f9f3ee" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
              {user ? `Welcome back, ${firstName}` : "Share Rides, Earn Rewards"}
            </h1>
            <p className="text-xl text-foreground/70 max-w-2xl mx-auto mb-8">
              {user ? heroSubtitle : "Earn points every time you share or join a ride."}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/search"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
              >
                <Search className="w-5 h-5" />
                Find a Ride
              </Link>
              <Link
                to="/publish"
                className="inline-flex items-center justify-center gap-2 bg-card text-foreground border border-border px-8 py-3 rounded-lg font-medium hover:bg-accent transition-colors shadow-sm"
              >
                <Car className="w-5 h-5" />
                Publish a Ride
              </Link>
            </div>
          </div>
          <SearchBar variant="hero" />
        </div>
      </section>

      {/* Personalized dashboard — signed-in users only */}
      {user && (
        <section className="py-10 md:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Requests waiting for the driver to accept */}
            {incoming.length > 0 && (
              <div className="mb-10">
                <h3 className="text-lg font-semibold mb-3">Requests to review ({incoming.length})</h3>
                <div className="space-y-3">
                  {incoming.map((r) => (
                    <Link
                      key={r.bookingId}
                      to={`/ride/${r.rideId}`}
                      className="block border border-primary/40 bg-primary/5 rounded-xl p-4 hover:shadow-md hover:shadow-primary/10 transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {r.passengerName} · {r.seats} {r.seats === 1 ? "seat" : "seats"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {r.from} → {r.to} · {formatDate(r.date)}
                          </p>
                          {r.pickupLabel && (
                            <p className="text-xs text-muted-foreground truncate">
                              Pickup: {r.pickupLabel}
                            </p>
                          )}
                        </div>
                        <span className="text-primary text-sm font-medium shrink-0">Review →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Your upcoming rides */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Your upcoming rides</h3>
                <Link to="/profile" className="text-sm text-primary hover:underline">
                  View all
                </Link>
              </div>
              {upcoming.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
                  No upcoming rides yet —{" "}
                  <Link to="/search" className="text-primary hover:underline">
                    find a ride
                  </Link>{" "}
                  or{" "}
                  <Link to="/publish" className="text-primary hover:underline">
                    publish one
                  </Link>
                  .
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {upcoming.map((t) => (
                    <Link
                      key={t.key}
                      to={t.rideId ? `/ride/${t.rideId}` : "/profile"}
                      className="block bg-card border border-border rounded-xl p-4 hover:border-primary hover:shadow-md hover:shadow-primary/10 transition-all"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {t.type === "driver" ? "Driving" : "Passenger"}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(t.date)}
                        </span>
                      </div>
                      <p className="font-medium truncate">
                        {t.from} → {t.to}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{t.detail}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Popular Rides */}
      <section id="rides-leaving-soon" className="py-16 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Rides Leaving Soon</h2>

          {loadingRides ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl h-32 animate-pulse"
                />
              ))}
            </div>
          ) : featuredRides.length === 0 ? (
            <div className="bg-card border border-primary rounded-xl p-10 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/15 rounded-full mb-4">
                <Car className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-lg mb-1">No rides leaving soon yet</p>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Be the first to share a ride — publish your trip, help others travel, and earn
                reward points when the trip is completed.
              </p>
              <Link
                to="/publish"
                className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Publish a ride
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {featuredRides.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Marketing sections — shown to logged-out visitors only */}
      {!user && (
        <>
      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-3">Why CAs Choose CACommute</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            A carpooling community built exclusively for Chartered Accountants — share rides, earn
            rewards, and connect with your peers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Earn Reward Points</h3>
              <p className="text-sm text-muted-foreground">
                Get 2 points for every ride you complete as a driver and 1 for each ride you complete as a rider
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Connect with Fellow CAs</h3>
              <p className="text-sm text-muted-foreground">
                Find and reach out to other CAs on the platform through Peer Connect
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Leaf className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Travel Greener Together</h3>
              <p className="text-sm text-muted-foreground">
                Share seats with peers heading your way and cut down on emissions
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <BadgeCheck className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Verified CA Community</h3>
              <p className="text-sm text-muted-foreground">
                Every member joins with their ICAI Membership ID — travel with people you trust
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rewards Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Gift className="w-7 h-7 text-primary" />
            <h2 className="text-3xl font-bold text-center">How Rewards Work</h2>
          </div>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            No fares, no payments — just points. Every shared ride earns you reward points you can
            be proud of.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-card border border-primary rounded-xl p-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/15 rounded-full mb-4">
                <Car className="w-7 h-7 text-primary" />
              </div>
              <div className="text-4xl font-bold text-primary mb-1">+2</div>
              <h3 className="font-semibold mb-2">Drive a ride</h3>
              <p className="text-sm text-muted-foreground">
                Share your empty seats and earn 2 points once the trip is completed with riders.
              </p>
            </div>
            <div className="bg-card border border-primary rounded-xl p-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/15 rounded-full mb-4">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div className="text-4xl font-bold text-primary mb-1">+1</div>
              <h3 className="font-semibold mb-2">Join a ride</h3>
              <p className="text-sm text-muted-foreground">
                Hop in as a passenger and earn 1 point for each completed trip you ride.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        className="relative bg-cover bg-top bg-no-repeat pt-16 md:pt-20 pb-8 min-h-[520px] md:min-h-[600px]"
        style={{ backgroundImage: `url('/cta-bg.png')`, backgroundColor: "#dfd6ce" }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Share Rides, Shrink Your Carbon Footprint
          </h2>
          <p className="text-xl text-foreground/70 mb-8">
            Every shared seat means fewer cars and less CO₂. Publish a ride, fill empty seats, and
            travel greener together.
          </p>
          <a
            href="/publish"
            className="inline-block bg-primary text-primary-foreground px-8 py-4 rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
          >
            Start Publishing Rides
          </a>
        </div>
      </section>
        </>
      )}
    </div>
  );
}

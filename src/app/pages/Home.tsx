import { useEffect, useState } from "react";
import { Link } from "react-router";
import { SearchBar } from "../components/SearchBar";
import { RideCard } from "../components/RideCard";
import { Ride } from "../data/mockData";
import { fetchRecentRides } from "../data/rides";
import { supabase } from "../lib/supabase";
import { Leaf, Award, Users, BadgeCheck, Car, Gift, Search } from "lucide-react";

export function Home() {
  const [featuredRides, setFeaturedRides] = useState<Ride[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);

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

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative bg-cover bg-bottom bg-no-repeat py-20 md:py-32"
        style={{ backgroundImage: `url('/hero-bg.png')`, backgroundColor: "#f9f3ee" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
              Share Rides, Earn Rewards
            </h1>
            <p className="text-xl text-foreground/70 max-w-2xl mx-auto mb-8">
              Earn points every time you share or join a ride.
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

      {/* Popular Rides */}
      <section className="py-16">
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
    </div>
  );
}

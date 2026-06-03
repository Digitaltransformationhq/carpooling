import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router";
import { SearchBar } from "../components/SearchBar";
import { RideCard } from "../components/RideCard";
import { Ride } from "../data/mockData";
import { fetchRecentRides } from "../data/rides";
import { Leaf, DollarSign, Users, Shield, MapPin, Car } from "lucide-react";

const RidesMap = lazy(() => import("../components/RidesMap"));

export function Home() {
  const [featuredRides, setFeaturedRides] = useState<Ride[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);

  useEffect(() => {
    fetchRecentRides(10)
      .then(setFeaturedRides)
      .catch(() => setFeaturedRides([]))
      .finally(() => setLoadingRides(false));
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative bg-cover bg-center py-20 md:py-32"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('https://images.unsplash.com/photo-1542242476-5a3565835a38?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoaWdod2F5JTIwcm9hZCUyMHRyaXB8ZW58MXx8fHwxNzgwMzc4ODE5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              Your Pick of Rides at Low Prices
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Save money, make friends, and travel sustainably
            </p>
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
                Be the first to share a ride — publish your trip and help others travel while
                splitting the cost.
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
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose RideShare?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Save Money</h3>
              <p className="text-sm text-muted-foreground">
                Travel at much lower cost than other options
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Meet People</h3>
              <p className="text-sm text-muted-foreground">
                Connect with interesting people during your journey
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Leaf className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Eco-Friendly</h3>
              <p className="text-sm text-muted-foreground">
                Reduce your carbon footprint by sharing rides
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Safe & Secure</h3>
              <p className="text-sm text-muted-foreground">
                Verified drivers and secure payment system
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-7 h-7 text-primary" />
            <h2 className="text-3xl font-bold">Explore Rides on the Map</h2>
          </div>
          <p className="text-muted-foreground mb-8">
            See where our community is travelling. Tap a pin to view rides from that city.
          </p>
          <Suspense
            fallback={<div className="h-[420px] w-full rounded-xl bg-muted animate-pulse" />}
          >
            <RidesMap />
          </Suspense>
        </div>
      </section>

      {/* CTA Section */}
      <section
        className="relative bg-cover bg-center py-20"
        style={{
          backgroundImage: `linear-gradient(rgba(3, 2, 19, 0.85), rgba(3, 2, 19, 0.85)), url('https://images.unsplash.com/photo-1539635278303-d4002c07eae3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZW9wbGUlMjB0cmF2ZWxpbmclMjB0b2dldGhlcnxlbnwxfHx8fDE3ODAzNzg4MTl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Share Rides, Shrink Your Carbon Footprint
          </h2>
          <p className="text-xl text-white/90 mb-8">
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

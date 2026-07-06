import { supabase } from "../lib/supabase";
import { geocode, routeBetween, corridorMatch, type Polyline } from "../lib/geo";
import { Ride } from "./mockData";

/** Shape of a row in the `rides` table. */
interface RideRow {
  id: string;
  user_id: string | null;
  driver_name: string;
  driver_avatar: string;
  driver_rating: number;
  driver_review_count: number;
  from_location: string;
  to_location: string;
  travel_date: string;
  departure_time: string;
  price: number;
  seats: number;
  distance: string;
  duration: string;
  car_model?: string | null;
  vehicle_type?: string | null;
  preferences: string[] | null;
  completed?: boolean | null;
  started?: boolean | null;
  booked_seats?: number | null;
  route_geom?: Polyline | null;
}

function mapRow(r: RideRow): Ride {
  return {
    id: r.id,
    driverId: r.user_id ?? undefined,
    driver: {
      name: r.driver_name,
      avatar: r.driver_avatar,
      rating: Number(r.driver_rating),
      reviewCount: r.driver_review_count,
    },
    from: r.from_location,
    to: r.to_location,
    date: r.travel_date,
    time: r.departure_time,
    price: r.price,
    seats: r.seats,
    distance: r.distance,
    duration: r.duration,
    vehicleType: r.vehicle_type === "2-wheeler" ? "2-wheeler" : "4-wheeler",
    preferences: r.preferences ?? [],
    completed: Boolean(r.completed),
    started: Boolean(r.started),
    bookedSeats: r.booked_seats ?? 0,
    route: r.route_geom ?? undefined,
  };
}

/** All rides, newest trips first. Falls back to local seed when Supabase isn't connected. */
export async function fetchRides(): Promise<Ride[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .order("travel_date", { ascending: true });
  if (error) throw error;
  return (data as RideRow[]).map(mapRow);
}

/** Most recently published rides first (for the home page). Excludes completed rides. */
export async function fetchRecentRides(limit = 10): Promise<Ride[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("completed", false)
    .eq("started", false) // hide rides already on the way
    .not("user_id", "is", null) // only real, user-published rides (hides seed/dummy data)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as RideRow[]).map(mapRow);
}

export async function fetchRideById(id: string): Promise<Ride | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("rides").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as RideRow) : null;
}

export interface SearchFilters {
  from?: string;
  to?: string;
  date?: string; // YYYY-MM-DD — rides on/after this date
  minSeats?: number;
}

export async function searchRides(filters: SearchFilters = {}): Promise<Ride[]> {
  const { from = "", to = "", date = "", minSeats = 0 } = filters;

  if (!supabase) return [];

  // Base query: active, user-published rides matching date/seat filters.
  let q = supabase
    .from("rides")
    .select("*")
    .eq("completed", false)
    .eq("started", false) // hide rides already on the way
    .not("user_id", "is", null); // only real, user-published rides
  if (date) q = q.gte("travel_date", date);
  if (minSeats) q = q.gte("seats", minSeats);
  const { data, error } = await q.order("travel_date", { ascending: true });
  if (error) throw error;
  const rides = (data as RideRow[]).map(mapRow);

  if (!from && !to) return rides;

  // Try route-corridor matching: geocode the rider's pickup + drop, then keep
  // rides whose route passes within 500m of both points (in travel order).
  if (from && to) {
    try {
      const [pickup, drop] = await Promise.all([geocode(from), geocode(to)]);
      if (pickup && drop) {
        const matched = rides
          .map((ride) => {
            if (ride.route && ride.route.length > 1) {
              const m = corridorMatch(pickup, drop, ride.route);
              return m.onRoute
                ? { ...ride, onRoute: { pickupDist: m.pickupDist, dropDist: m.dropDist } }
                : null;
            }
            // no geometry stored → fall back to text match for this ride
            return textMatch(ride, from, to) ? ride : null;
          })
          .filter((r): r is Ride => r !== null)
          .sort((a, b) => (a.onRoute?.pickupDist ?? 1e9) - (b.onRoute?.pickupDist ?? 1e9));
        return matched;
      }
    } catch {
      // geocoding/routing unavailable — fall through to text matching
    }
  }

  // Fallback: simple text match on the typed locations.
  return rides.filter((r) => textMatch(r, from, to));
}

/** Case-insensitive substring match on a ride's from/to text. */
function textMatch(ride: Ride, from: string, to: string): boolean {
  const okFrom = !from || ride.from.toLowerCase().includes(from.toLowerCase());
  const okTo = !to || ride.to.toLowerCase().includes(to.toLowerCase());
  return okFrom && okTo;
}

export interface NewRideInput {
  from: string;
  to: string;
  date: string;
  time: string;
  vehicleType: "2-wheeler" | "4-wheeler";
  seats: number;
  preferences?: string[];
  /** Exact coordinates from the address picker (skips re-geocoding the text). */
  fromCoords?: { lat: number; lng: number } | null;
  toCoords?: { lat: number; lng: number } | null;
}

/** Current signed-in user's id + display name (null when logged out). */
async function currentUser() {
  if (!supabase) return { id: null as string | null, name: "You" };
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return { id: null as string | null, name: "You" };
  const name =
    (u.user_metadata?.full_name as string) || u.email?.split("@")[0] || "You";
  return { id: u.id, name };
}

export async function createRide(input: NewRideInput): Promise<Ride> {
  if (!supabase) {
    throw new Error("Supabase isn't connected yet — add your keys to .env to publish rides.");
  }
  const me = await currentUser();

  // Best-effort: geocode the endpoints and compute the driving route so the
  // ride can be matched along its 500m corridor. Failures don't block publish.
  let route: Polyline | null = null;
  try {
    // Prefer the exact coordinates the user picked; fall back to geocoding text.
    const [a, b] = await Promise.all([
      input.fromCoords ?? geocode(input.from),
      input.toCoords ?? geocode(input.to),
    ]);
    if (a && b) route = await routeBetween(a, b);
  } catch {
    route = null;
  }

  const row = {
    user_id: me.id,
    driver_name: me.name,
    driver_avatar:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
    driver_rating: 5.0,
    driver_review_count: 0,
    from_location: input.from,
    to_location: input.to,
    travel_date: input.date,
    departure_time: input.time,
    // rides are free — the app rewards sharing with points (see supabase/rewards.sql),
    // not money. the price column stays at 0 for schema compatibility.
    price: 0,
    // a two-wheeler only carries one passenger
    seats: input.vehicleType === "2-wheeler" ? 1 : input.seats,
    distance: "—",
    duration: "—",
    vehicle_type: input.vehicleType,
    preferences: input.preferences ?? [],
    route_geom: route,
  };
  const { data, error } = await supabase.from("rides").insert(row).select().single();
  if (error) throw error;
  return mapRow(data as RideRow);
}

/**
 * Compute and store the driving route for the current user's rides that don't
 * have one yet (e.g. rides published before route-corridor matching existed).
 * RLS limits this to the signed-in driver's own rides. Returns how many were
 * updated. Best-effort — skips any ride whose endpoints can't be geocoded.
 */
export async function backfillMissingRoutes(): Promise<number> {
  if (!supabase) return 0;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;

  const { data, error } = await supabase
    .from("rides")
    .select("id, from_location, to_location")
    .eq("user_id", auth.user.id)
    .is("route_geom", null);
  if (error || !data) return 0;

  let updated = 0;
  for (const r of data as { id: string; from_location: string; to_location: string }[]) {
    try {
      const [a, b] = await Promise.all([geocode(r.from_location), geocode(r.to_location)]);
      if (!a || !b) continue;
      const route = await routeBetween(a, b);
      if (!route) continue;
      const { error: upErr } = await supabase
        .from("rides")
        .update({ route_geom: route })
        .eq("id", r.id);
      if (!upErr) updated++;
    } catch {
      // skip this ride, keep going
    }
  }
  return updated;
}

export async function deleteRide(rideId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const { error } = await supabase.from("rides").delete().eq("id", rideId);
  if (error) throw error;
}

export async function markRideComplete(rideId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const { error } = await supabase.from("rides").update({ completed: true }).eq("id", rideId);
  if (error) throw error;
}

export async function markRideStarted(rideId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const { error } = await supabase.from("rides").update({ started: true }).eq("id", rideId);
  if (error) throw error;
}

/** Undo "start" — puts the ride back to Upcoming so it's discoverable again. */
export async function markRideNotStarted(rideId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const { error } = await supabase.from("rides").update({ started: false }).eq("id", rideId);
  if (error) throw error;
}

export type BookingStatus = "pending" | "accepted";

export interface RideBooking {
  id: string;
  passenger_name: string;
  passenger_phone: string | null;
  seats: number;
  status: BookingStatus;
}

/**
 * Rider requests to join a ride. Creates a PENDING request — the seat isn't
 * reserved until the driver accepts it (see {@link acceptBooking}).
 */
export async function requestBooking(rideId: string, seats = 1): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase isn't connected yet — add your keys to .env to request a seat.");
  }
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Please sign in to request a seat.");

  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();
  const name = prof?.full_name || user.email?.split("@")[0] || "Guest";

  const { error } = await supabase.from("bookings").insert({
    ride_id: rideId,
    seats,
    passenger_name: name,
    passenger_phone: prof?.phone ?? null,
    user_id: user.id,
    status: "pending",
  });
  if (error) throw error;
}

/** Driver accepts a pending request — confirms it and reserves the seat(s). */
export async function acceptBooking(bookingId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const { error } = await supabase.rpc("accept_booking", { p_booking_id: bookingId });
  if (error) throw error;
}

/** Requests + confirmed riders on a ride (visible to the ride's driver). */
export async function fetchRideBookings(rideId: string): Promise<RideBooking[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select("id, passenger_name, passenger_phone, seats, status")
    .eq("ride_id", rideId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as RideBooking[]) ?? [];
}

/** Cancel a booking — by the rider (cancel) or the driver (remove rider). Frees the seat(s). */
export async function removeBooking(bookingId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
  if (error) throw error;
}

/** The current user's own bookings/requests on a ride. */
export async function fetchMyBookings(rideId: string): Promise<RideBooking[]> {
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select("id, passenger_name, passenger_phone, seats, status")
    .eq("ride_id", rideId)
    .eq("user_id", auth.user.id);
  if (error) throw error;
  return (data as RideBooking[]) ?? [];
}

/**
 * Rider cancels their own seat(s) on a ride — frees the seat(s).
 * - `seats`: how many to cancel (defaults to all).
 * - `status`: limit to `"pending"` (withdraw a request) or `"accepted"`
 *   (cancel a confirmed seat); omit to cancel across both.
 */
export async function cancelMyBooking(
  rideId: string,
  seats?: number,
  status?: BookingStatus
): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  // A large default count cancels everything matching the status filter.
  const count = seats ?? 1_000_000;
  const { error } = await supabase.rpc("cancel_my_seats", {
    p_ride_id: rideId,
    p_seats: count,
    p_status: status ?? null,
  });
  if (error) throw error;
}

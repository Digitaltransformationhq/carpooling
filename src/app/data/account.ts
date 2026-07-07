import { supabase } from "../lib/supabase";

export interface UserStats {
  ridesAsDriver: number;
  ridesAsPassenger: number;
  /** Reward points: +2 per completed ride you drove (with riders), +1 per completed ride you joined. */
  points: number;
}

export interface Trip {
  key: string;
  rideId?: string; // present for rides the user published (driver)
  type: "driver" | "passenger";
  from: string;
  to: string;
  date: string;
  completed: boolean;
  started: boolean;
  detail: string;
}

const EMPTY_STATS: UserStats = {
  ridesAsDriver: 0,
  ridesAsPassenger: 0,
  points: 0,
};

export async function fetchUserStats(userId: string): Promise<UserStats> {
  if (!supabase) return EMPTY_STATS;
  const [drivers, passengers, profile] = await Promise.all([
    supabase.from("rides").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("profiles").select("points").eq("id", userId).maybeSingle(),
  ]);

  return {
    ridesAsDriver: drivers.count ?? 0,
    ridesAsPassenger: passengers.count ?? 0,
    points: (profile.data?.points as number | undefined) ?? 0,
  };
}

export interface IncomingRequest {
  bookingId: string;
  rideId: string;
  passengerName: string;
  seats: number;
  from: string;
  to: string;
  date: string;
  pickupLabel: string | null;
}

/** Pending join requests on rides the user is driving (for their dashboard). */
export async function fetchIncomingRequests(userId: string): Promise<IncomingRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, seats, passenger_name, pickup_label, ride_id, created_at, rides!inner(user_id, from_location, to_location, travel_date, completed)"
    )
    .eq("status", "pending")
    .eq("rides.user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return ((data as any[]) ?? [])
    .map((b) => {
      const ride = Array.isArray(b.rides) ? b.rides[0] : b.rides;
      if (!ride || ride.completed) return null;
      return {
        bookingId: b.id,
        rideId: b.ride_id,
        passengerName: b.passenger_name,
        seats: b.seats,
        from: ride.from_location,
        to: ride.to_location,
        date: ride.travel_date,
        pickupLabel: b.pickup_label ?? null,
      };
    })
    .filter(Boolean) as IncomingRequest[];
}

export async function fetchMyTrips(userId: string): Promise<Trip[]> {
  if (!supabase) return [];

  const [ridesRes, bookingsRes] = await Promise.all([
    supabase
      .from("rides")
      .select("id, from_location, to_location, travel_date, seats, completed, started, booked_seats")
      .eq("user_id", userId)
      .order("travel_date", { ascending: true }),
    supabase
      .from("bookings")
      .select("id, created_at, status, ride_id, rides(from_location, to_location, travel_date, driver_name, completed, started)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const driverTrips: Trip[] = ((ridesRes.data as any[]) ?? []).map((r) => ({
    key: `d-${r.id}`,
    rideId: r.id,
    type: "driver",
    from: r.from_location,
    to: r.to_location,
    date: r.travel_date,
    completed: Boolean(r.completed),
    started: Boolean(r.started),
    detail: `${Math.max(0, r.seats - (r.booked_seats ?? 0))} of ${r.seats} seats left`,
  }));

  const passengerTrips: Trip[] = ((bookingsRes.data as any[]) ?? [])
    .map((b) => {
      const ride = Array.isArray(b.rides) ? b.rides[0] : b.rides;
      if (!ride) return null;
      const statusLabel = b.status === "pending" ? "Request pending" : "Confirmed";
      return {
        key: `p-${b.id}`,
        rideId: b.ride_id,
        type: "passenger" as const,
        from: ride.from_location,
        to: ride.to_location,
        date: ride.travel_date,
        completed: Boolean(ride.completed),
        started: Boolean(ride.started),
        detail: `${statusLabel} · Driver: ${ride.driver_name}`,
      };
    })
    .filter(Boolean) as Trip[];

  return [...driverTrips, ...passengerTrips];
}

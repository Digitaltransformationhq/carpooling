import { supabase } from "../lib/supabase";

export interface UserStats {
  ridesAsDriver: number;
  ridesAsPassenger: number;
}

export interface Trip {
  key: string;
  rideId?: string; // present for rides the user published (driver)
  type: "driver" | "passenger";
  from: string;
  to: string;
  date: string;
  completed: boolean;
  detail: string;
}

const EMPTY_STATS: UserStats = {
  ridesAsDriver: 0,
  ridesAsPassenger: 0,
};

export async function fetchUserStats(userId: string): Promise<UserStats> {
  if (!supabase) return EMPTY_STATS;
  const [drivers, passengers] = await Promise.all([
    supabase.from("rides").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  return {
    ridesAsDriver: drivers.count ?? 0,
    ridesAsPassenger: passengers.count ?? 0,
  };
}

export async function fetchMyTrips(userId: string): Promise<Trip[]> {
  if (!supabase) return [];

  const [ridesRes, bookingsRes] = await Promise.all([
    supabase
      .from("rides")
      .select("id, from_location, to_location, travel_date, seats, completed, booked_seats")
      .eq("user_id", userId)
      .order("travel_date", { ascending: true }),
    supabase
      .from("bookings")
      .select("id, created_at, rides(from_location, to_location, travel_date, driver_name)")
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
    detail: `${Math.max(0, r.seats - (r.booked_seats ?? 0))} of ${r.seats} seats left`,
  }));

  const passengerTrips: Trip[] = ((bookingsRes.data as any[]) ?? [])
    .map((b) => {
      const ride = Array.isArray(b.rides) ? b.rides[0] : b.rides;
      if (!ride) return null;
      return {
        key: `p-${b.id}`,
        type: "passenger" as const,
        from: ride.from_location,
        to: ride.to_location,
        date: ride.travel_date,
        completed: false,
        detail: `Driver: ${ride.driver_name}`,
      };
    })
    .filter(Boolean) as Trip[];

  return [...driverTrips, ...passengerTrips];
}

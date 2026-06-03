import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Ride } from "../data/mockData";
import {
  fetchRideById,
  createBooking,
  deleteRide,
  markRideComplete,
  markRideStarted,
  fetchRideBookings,
  removeBooking,
  fetchMyBookings,
  cancelMyBooking,
  type RideBooking,
} from "../data/rides";
import { fetchProfile } from "../data/profiles";
import { useAuth } from "../context/AuthContext";
import { formatDate, formatTime } from "../lib/format";
import { Clock, Shield, Phone, Users, ChevronLeft, Plus, Minus } from "lucide-react";

const FALLBACK_PHONE = "+91 98765 43210";

export function RideDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [driverPhone, setDriverPhone] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [riders, setRiders] = useState<RideBooking[]>([]);
  const [myBookings, setMyBookings] = useState<RideBooking[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchRideById(id)
      .then(setRide)
      .catch(() => setRide(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Look up the driver's phone from their profile (set in Edit Profile).
  useEffect(() => {
    if (!ride?.driverId) return;
    fetchProfile(ride.driverId)
      .then((p) => {
        if (p?.phone) setDriverPhone(p.phone);
      })
      .catch(() => {});
  }, [ride?.driverId]);

  // If you're the driver, load the riders who booked this ride.
  useEffect(() => {
    if (!ride || !authUser || ride.driverId !== authUser.id) {
      setRiders([]);
      return;
    }
    fetchRideBookings(ride.id).then(setRiders).catch(() => {});
  }, [ride, authUser]);

  // If you're a rider (not the driver), load your own booking on this ride.
  useEffect(() => {
    if (!ride || !authUser || ride.driverId === authUser.id) {
      setMyBookings([]);
      return;
    }
    fetchMyBookings(ride.id).then(setMyBookings).catch(() => {});
  }, [ride, authUser]);

  const refreshRide = async (rideId: string) => {
    const updated = await fetchRideById(rideId);
    if (updated) setRide(updated);
  };

  const handleCancelMyBooking = async () => {
    if (!ride) return;
    if (!window.confirm("Cancel your booking?")) return;
    try {
      await cancelMyBooking(ride.id);
      await refreshRide(ride.id);
      setMyBookings([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not cancel booking");
    }
  };

  const handleBook = async () => {
    if (!ride) return;
    if (!authUser) {
      navigate("/login");
      return;
    }
    setBooking(true);
    try {
      await createBooking(ride.id, passengers);
      alert(`${passengers} ${passengers === 1 ? "seat" : "seats"} booked! 🎉`);
      await refreshRide(ride.id);
      fetchMyBookings(ride.id).then(setMyBookings).catch(() => {});
      setPassengers(1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  };

  const handleRemoveRider = async (bookingId: string) => {
    if (!ride) return;
    try {
      await removeBooking(bookingId);
      const [rb] = await Promise.all([fetchRideBookings(ride.id), refreshRide(ride.id)]);
      setRiders(rb);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove rider");
    }
  };

  const handleStart = async () => {
    if (!ride) return;
    try {
      await markRideStarted(ride.id);
      setRide({ ...ride, started: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update ride");
    }
  };

  const handleComplete = async () => {
    if (!ride) return;
    try {
      await markRideComplete(ride.id);
      setRide({ ...ride, completed: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update ride");
    }
  };

  const handleRemove = async () => {
    if (!ride) return;
    if (!window.confirm("Remove this published ride?")) return;
    try {
      await deleteRide(ride.id);
      navigate("/profile");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove ride");
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-muted-foreground">
        Loading ride…
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Ride not found</h1>
        <button
          onClick={() => navigate("/search")}
          className="text-foreground underline hover:opacity-80"
        >
          Back to search
        </button>
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const isOwner = !!authUser && !!ride.driverId && ride.driverId === authUser.id;
  const isCompleted = !!ride.completed || ride.date < todayStr;
  const available = Math.max(0, ride.seats - (ride.bookedSeats ?? 0));
  const isFull = available <= 0;
  const mySeats = myBookings.reduce((sum, b) => sum + b.seats, 0);
  const isStarted = !!ride.started && !isCompleted;
  const statusLabel = isCompleted ? "Completed" : isStarted ? "On the way" : "Upcoming";
  const statusClass = isCompleted
    ? "bg-muted text-muted-foreground"
    : isStarted
    ? "bg-green-100 text-green-700"
    : "bg-primary/20 text-foreground";

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-foreground hover:underline mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to results
        </button>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Trip + booking — one card, split by a light divider */}
          <div className="bg-card border border-primary rounded-xl">
            {/* Trip section */}
            <div className="p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Origin: name then square marker */}
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold text-lg truncate">{ride.from}</p>
                  <span className="w-5 h-5 rounded-[4px] bg-primary flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-[1px] bg-white"></span>
                  </span>
                </div>

                {/* Connector — animated when live, static when completed */}
                <div
                  className={`flex-1 h-[3px] ${isCompleted ? "route-still" : "route-flow"}`}
                  aria-hidden="true"
                ></div>

                {/* Destination: triangle (pointing toward) then name */}
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
                  <p className="font-semibold text-lg truncate">{ride.to}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-foreground mt-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{formatDate(ride.date)} at {formatTime(ride.time)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {isFull ? (
                    <span className="text-destructive">Seats full</span>
                  ) : (
                    <span>{available} {available === 1 ? "seat" : "seats"} available</span>
                  )}
                </div>
              </div>
            </div>

            {/* light separation line (inset from both sides) */}
            <div className="mx-6 border-t border-border"></div>

            {/* Booking section (or owner controls when it's your ride) */}
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold mb-1">₹{ride.price}</div>
                <div className="text-sm text-muted-foreground">per passenger</div>
              </div>

              {isOwner ? (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <span className={`text-xs px-3 py-1 rounded-full ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground text-center mb-5">
                    This is your published ride.
                  </p>
                  {!isCompleted && !isStarted && (
                    <button
                      onClick={handleStart}
                      className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors mb-3"
                    >
                      Start ride
                    </button>
                  )}
                  {isStarted && (
                    <button
                      onClick={handleComplete}
                      className="w-full border border-primary py-3 rounded-lg font-medium hover:bg-primary/10 transition-colors mb-3"
                    >
                      Mark as complete
                    </button>
                  )}
                  <button
                    onClick={handleRemove}
                    className="w-full border border-destructive/40 text-destructive py-3 rounded-lg font-medium hover:bg-destructive/10 transition-colors"
                  >
                    Remove ride
                  </button>

                  {/* Riders who booked this ride */}
                  <div className="mt-6 pt-6 border-t border-border text-left">
                    <p className="font-medium mb-3">
                      Riders{" "}
                      <span className="text-muted-foreground font-normal">
                        ({ride.bookedSeats ?? 0}/{ride.seats} seats booked)
                      </span>
                    </p>
                    {riders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No riders yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {riders.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-2 border border-border rounded-lg p-3"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{r.passenger_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.seats} {r.seats === 1 ? "seat" : "seats"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {r.passenger_phone ? (
                                <a
                                  href={`tel:${r.passenger_phone.replace(/[^+\d]/g, "")}`}
                                  aria-label={`Call ${r.passenger_name}`}
                                  className="w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
                                >
                                  <Phone className="w-4 h-4 text-primary-foreground" />
                                </a>
                              ) : (
                                <span
                                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
                                  title="No phone on file"
                                >
                                  <Phone className="w-4 h-4 text-muted-foreground" />
                                </span>
                              )}
                              <button
                                onClick={() => handleRemoveRider(r.id)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : isCompleted ? (
                <p className="text-sm text-muted-foreground text-center">
                  This ride is completed.
                </p>
              ) : isStarted ? (
                <div className="text-center">
                  {mySeats > 0 && (
                    <p className="font-medium mb-2">
                      You've booked {mySeats} {mySeats === 1 ? "seat" : "seats"}.
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    The driver is on the way — this ride has departed.
                  </p>
                </div>
              ) : (
                <>
                  {mySeats > 0 && (
                    <div className="mb-5 border border-primary rounded-lg p-4 text-center">
                      <p className="font-medium mb-2">
                        You've booked {mySeats} {mySeats === 1 ? "seat" : "seats"}.
                      </p>
                      <button
                        onClick={handleCancelMyBooking}
                        className="text-sm font-medium text-destructive hover:underline"
                      >
                        Cancel booking
                      </button>
                    </div>
                  )}

                  {isFull ? (
                    <>
                      <button
                        disabled
                        className="w-full bg-muted text-muted-foreground py-3 rounded-lg font-medium cursor-not-allowed"
                      >
                        Seats full
                      </button>
                      {mySeats === 0 && (
                        <p className="text-sm text-muted-foreground text-center mt-3">
                          This ride is fully booked.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Passenger selector */}
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-sm font-medium">Passengers</span>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setPassengers((n) => Math.max(1, n - 1))}
                        disabled={passengers <= 1}
                        aria-label="Remove passenger"
                        className="w-9 h-9 rounded-full border border-primary flex items-center justify-center hover:bg-primary/10 transition-colors disabled:opacity-40"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center font-semibold text-lg">{passengers}</span>
                      <button
                        type="button"
                        onClick={() => setPassengers((n) => Math.min(available, n + 1))}
                        disabled={passengers >= available}
                        aria-label="Add passenger"
                        className="w-9 h-9 rounded-full border border-primary flex items-center justify-center hover:bg-primary/10 transition-colors disabled:opacity-40"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Price per passenger × {passengers}
                      </span>
                      <span className="font-semibold">₹{ride.price}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-lg">₹{ride.price * passengers}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleBook}
                    disabled={booking}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors mb-3 disabled:opacity-60"
                  >
                    {booking ? "Booking…" : "Book Now"}
                  </button>

                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    <span>Secure payment with buyer protection</span>
                  </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Driver card */}
          <div className="bg-card border border-primary rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">About the driver</h2>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={ride.driver.avatar}
                  alt={ride.driver.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
                <h3 className="font-semibold text-lg truncate">{ride.driver.name}</h3>
              </div>
              <a
                href={`tel:${(driverPhone || FALLBACK_PHONE).replace(/[^+\d]/g, "")}`}
                aria-label="Call driver"
                className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors"
              >
                <Phone className="w-5 h-5 text-primary-foreground" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

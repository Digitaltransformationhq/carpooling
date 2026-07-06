import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Ride } from "../data/mockData";
import {
  fetchRideById,
  requestBooking,
  acceptBooking,
  deleteRide,
  markRideComplete,
  markRideStarted,
  markRideNotStarted,
  fetchRideBookings,
  removeBooking,
  fetchMyBookings,
  cancelMyBooking,
  type RideBooking,
} from "../data/rides";
import { fetchProfile } from "../data/profiles";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatDate, formatTime } from "../lib/format";
import { Clock, Shield, Phone, Users, ChevronLeft, Plus, Minus, Check, X, Bike, Car } from "lucide-react";

const FALLBACK_PHONE = "+91 98765 43210";

export function RideDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser, refreshProfile } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [driverPhone, setDriverPhone] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [cancelCount, setCancelCount] = useState(1);
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

  // Live updates — refresh automatically when this ride or its bookings change
  // in the database (e.g. the driver accepts a request, or a seat is cancelled),
  // so neither side has to reload the page.
  useEffect(() => {
    if (!supabase || !id) return;
    const client = supabase;

    const reload = async () => {
      const updated = await fetchRideById(id).catch(() => null);
      if (!updated) return;
      setRide(updated);
      if (authUser && updated.driverId === authUser.id) {
        fetchRideBookings(id).then(setRiders).catch(() => {});
      } else if (authUser) {
        fetchMyBookings(id).then(setMyBookings).catch(() => {});
      }
      // A booking change here may have awarded/removed a point (e.g. the driver
      // just accepted this rider) — refresh the points badge live.
      refreshProfile();
    };

    const channel = client
      .channel(`ride-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rides", filter: `id=eq.${id}` },
        reload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `ride_id=eq.${id}` },
        reload
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [id, authUser, refreshProfile]);

  const refreshRide = async (rideId: string) => {
    const updated = await fetchRideById(rideId);
    if (updated) setRide(updated);
  };

  const handleCancelMyBooking = async (seatsToCancel: number, status?: "pending" | "accepted") => {
    if (!ride) return;
    const noun = status === "pending" ? "request" : "booking";
    const message =
      seatsToCancel >= mySeats
        ? `Cancel your entire ${noun}?`
        : `Cancel ${seatsToCancel} of your ${mySeats} seats?`;
    if (!window.confirm(message)) return;
    try {
      await cancelMyBooking(ride.id, seatsToCancel, status);
      await refreshRide(ride.id);
      const mine = await fetchMyBookings(ride.id);
      setMyBookings(mine);
      setCancelCount(1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not cancel booking");
    }
  };

  const handleRequest = async () => {
    if (!ride) return;
    if (!authUser) {
      navigate("/login");
      return;
    }
    // Don't let a rider request more seats than the ride actually has left,
    // counting their own pending requests (which aren't reserved yet).
    const avail = Math.max(0, ride.seats - (ride.bookedSeats ?? 0));
    const myPend = myBookings
      .filter((b) => b.status === "pending")
      .reduce((sum, b) => sum + b.seats, 0);
    const seats = Math.min(passengers, Math.max(0, avail - myPend));
    if (seats < 1) {
      alert("You can't request more seats than are available on this ride.");
      return;
    }
    setBooking(true);
    try {
      await requestBooking(ride.id, seats);
      alert(
        `Request sent for ${seats} ${seats === 1 ? "seat" : "seats"}! ` +
          "The driver will confirm it shortly."
      );
      await refreshRide(ride.id);
      fetchMyBookings(ride.id).then(setMyBookings).catch(() => {});
      setPassengers(1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBooking(false);
    }
  };

  const handleAcceptRequest = async (bookingId: string) => {
    if (!ride) return;
    try {
      await acceptBooking(bookingId);
      const [rb] = await Promise.all([fetchRideBookings(ride.id), refreshRide(ride.id)]);
      setRiders(rb);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not accept request");
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
      refreshProfile(); // completing a ride (with riders) awards points
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update ride");
    }
  };

  const handleUnstart = async () => {
    if (!ride) return;
    try {
      await markRideNotStarted(ride.id);
      setRide({ ...ride, started: false });
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
  const myAccepted = myBookings
    .filter((b) => b.status === "accepted")
    .reduce((sum, b) => sum + b.seats, 0);
  const myPending = myBookings
    .filter((b) => b.status === "pending")
    .reduce((sum, b) => sum + b.seats, 0);
  const mySeats = myAccepted + myPending;
  // seats this rider can still request: what's left, minus their own pending
  const maxRequestable = Math.max(0, available - myPending);
  const pendingRiders = riders.filter((r) => r.status === "pending");
  const acceptedRiders = riders.filter((r) => r.status === "accepted");
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
              {/* Names on top, animated connector full-width below — gives the
                  route-flow animation room at every screen size (same on the
                  driver + rider views, which share this header). */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-lg truncate min-w-0">{ride.from}</p>
                  <p className="font-semibold text-lg truncate min-w-0 text-right">{ride.to}</p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Origin square marker */}
                  <span className="w-5 h-5 rounded-[4px] bg-primary flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-[1px] bg-white"></span>
                  </span>

                  {/* Connector — animated when live, static when completed */}
                  <div
                    className={`h-[3px] flex-1 ${isCompleted ? "route-still" : "route-flow"}`}
                    aria-hidden="true"
                  ></div>

                  {/* Destination triangle marker */}
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
              <div className="flex items-center justify-center gap-2 mb-6">
                {ride.vehicleType === "2-wheeler" ? (
                  <Bike className="w-5 h-5 text-primary" />
                ) : (
                  <Car className="w-5 h-5 text-primary" />
                )}
                <span className="font-semibold">
                  {ride.vehicleType === "2-wheeler" ? "Two-wheeler" : "Four-wheeler"}
                </span>
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
                    <>
                      <button
                        onClick={handleComplete}
                        className="w-full border border-primary py-3 rounded-lg font-medium hover:bg-primary/10 transition-colors mb-3"
                      >
                        Mark as complete
                      </button>
                      <button
                        onClick={handleUnstart}
                        className="w-full text-sm text-muted-foreground hover:text-foreground underline mb-3"
                      >
                        Undo start — make this ride visible again
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleRemove}
                    className="w-full border border-destructive/40 text-destructive py-3 rounded-lg font-medium hover:bg-destructive/10 transition-colors"
                  >
                    Remove ride
                  </button>

                  {/* Join requests waiting for the driver to confirm */}
                  <div className="mt-6 pt-6 border-t border-border text-left">
                    <p className="font-medium mb-3">
                      Requests{" "}
                      <span className="text-muted-foreground font-normal">
                        ({pendingRiders.length})
                      </span>
                    </p>
                    {pendingRiders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No pending requests.</p>
                    ) : (
                      <div className="space-y-2">
                        {pendingRiders.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-2 border border-primary/40 bg-primary/5 rounded-lg p-3"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{r.passenger_name}</p>
                              <p className="text-xs text-muted-foreground">
                                wants {r.seats} {r.seats === 1 ? "seat" : "seats"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleAcceptRequest(r.id)}
                                disabled={r.seats > available}
                                title={r.seats > available ? "Not enough seats left" : "Accept"}
                                aria-label={`Accept ${r.passenger_name}`}
                                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Check className="w-4 h-4" />
                                Accept
                              </button>
                              <button
                                onClick={() => handleRemoveRider(r.id)}
                                aria-label={`Decline ${r.passenger_name}`}
                                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <X className="w-4 h-4" />
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirmed riders on this ride */}
                  <div className="mt-6 pt-6 border-t border-border text-left">
                    <p className="font-medium mb-3">
                      Confirmed riders{" "}
                      <span className="text-muted-foreground font-normal">
                        ({ride.bookedSeats ?? 0}/{ride.seats} seats booked)
                      </span>
                    </p>
                    {acceptedRiders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No confirmed riders yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {acceptedRiders.map((r) => (
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
                  {myAccepted > 0 && (
                    <p className="font-medium mb-2">
                      You've booked {myAccepted} {myAccepted === 1 ? "seat" : "seats"}.
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    This ride has started.
                  </p>
                </div>
              ) : (
                <>
                  {/* Pending request — waiting for the driver to accept */}
                  {myPending > 0 && (
                    <div className="mb-5 border border-primary/40 bg-primary/5 rounded-lg p-4 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-primary/20 text-foreground mb-2">
                        <Clock className="w-3.5 h-3.5" />
                        Awaiting confirmation
                      </span>
                      <p className="font-medium mb-2">
                        Request sent for {myPending} {myPending === 1 ? "seat" : "seats"}.
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        The driver hasn't accepted yet. Your seat isn't reserved until they confirm.
                      </p>
                      <button
                        onClick={() => handleCancelMyBooking(myPending, "pending")}
                        className="text-sm font-medium text-destructive hover:underline"
                      >
                        Withdraw request
                      </button>
                    </div>
                  )}

                  {/* Confirmed booking — accepted by the driver */}
                  {myAccepted > 0 && (
                    <div className="mb-5 border border-primary rounded-lg p-4">
                      <p className="font-medium mb-1 text-center">
                        Confirmed — you've booked {myAccepted}{" "}
                        {myAccepted === 1 ? "seat" : "seats"}.
                      </p>
                      <p className="text-xs text-muted-foreground text-center mb-3">
                        The driver accepted your request. 🎉
                      </p>
                      {myAccepted > 1 && (
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">Seats to cancel</span>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setCancelCount((n) => Math.max(1, n - 1))}
                              disabled={cancelCount <= 1}
                              aria-label="Cancel fewer seats"
                              className="w-9 h-9 rounded-full border border-primary flex items-center justify-center hover:bg-primary/10 transition-colors disabled:opacity-40"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-6 text-center font-semibold text-lg">
                              {Math.min(cancelCount, myAccepted)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCancelCount((n) => Math.min(myAccepted, n + 1))}
                              disabled={cancelCount >= myAccepted}
                              aria-label="Cancel more seats"
                              className="w-9 h-9 rounded-full border border-primary flex items-center justify-center hover:bg-primary/10 transition-colors disabled:opacity-40"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() =>
                          handleCancelMyBooking(
                            myAccepted === 1 ? 1 : Math.min(cancelCount, myAccepted),
                            "accepted"
                          )
                        }
                        className="w-full text-sm font-medium text-destructive border border-destructive/40 rounded-lg py-2.5 hover:bg-destructive/10 transition-colors"
                      >
                        {myAccepted === 1
                          ? "Cancel booking"
                          : cancelCount >= myAccepted
                          ? "Cancel all seats"
                          : `Cancel ${cancelCount} ${cancelCount === 1 ? "seat" : "seats"}`}
                      </button>
                    </div>
                  )}

                  {maxRequestable <= 0 ? (
                    <>
                      <button
                        disabled
                        className="w-full bg-muted text-muted-foreground py-3 rounded-lg font-medium cursor-not-allowed"
                      >
                        {isFull ? "Seats full" : "Request limit reached"}
                      </button>
                      {isFull && mySeats === 0 && (
                        <p className="text-sm text-muted-foreground text-center mt-3">
                          This ride is fully booked.
                        </p>
                      )}
                      {!isFull && (
                        <p className="text-sm text-muted-foreground text-center mt-3">
                          You've already requested all available seats. Cancel a request to change
                          it.
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
                          <span className="w-6 text-center font-semibold text-lg">
                            {Math.min(passengers, maxRequestable)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPassengers((n) => Math.min(maxRequestable, n + 1))}
                            disabled={passengers >= maxRequestable}
                            aria-label="Add passenger"
                            className="w-9 h-9 rounded-full border border-primary flex items-center justify-center hover:bg-primary/10 transition-colors disabled:opacity-40"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between border-t border-border py-3 mb-6">
                        <span className="font-semibold">Seats requested</span>
                        <span className="font-bold text-lg">
                          {Math.min(passengers, maxRequestable)}
                        </span>
                      </div>

                      <button
                        onClick={handleRequest}
                        disabled={booking}
                        className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors mb-3 disabled:opacity-60"
                      >
                        {booking ? "Sending request…" : "Request to join"}
                      </button>

                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Shield className="w-4 h-4" />
                        <span>The driver reviews and confirms your seat</span>
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

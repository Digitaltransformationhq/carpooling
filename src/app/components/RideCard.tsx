import { Link } from "react-router";
import { Clock, Users } from "lucide-react";
import { Ride } from "../data/mockData";
import { formatDate, formatTime } from "../lib/format";

interface RideCardProps {
  ride: Ride;
}

export function RideCard({ ride }: RideCardProps) {
  const available = Math.max(0, ride.seats - (ride.bookedSeats ?? 0));
  return (
    <Link
      to={`/ride/${ride.id}`}
      className="block bg-card border border-primary rounded-xl p-4 md:p-6 transition-all hover:shadow-lg hover:shadow-primary/10"
    >
      {/* Driver + price */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={ride.driver.avatar}
            alt={ride.driver.name}
            className="w-12 h-12 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="font-semibold truncate">{ride.driver.name}</p>
            <p className="text-sm text-muted-foreground">Driver</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold">₹{ride.price}</div>
          <div className="text-sm text-muted-foreground">per person</div>
        </div>
      </div>

      {/* Route */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Origin: name then square marker */}
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold truncate">{ride.from}</p>
          <span className="w-5 h-5 rounded-[4px] bg-primary flex items-center justify-center shrink-0">
            <span className="w-2 h-2 rounded-[1px] bg-white"></span>
          </span>
        </div>

        {/* Animated dashed connector */}
        <div className="flex-1 h-[3px] route-flow" aria-hidden="true"></div>

        {/* Destination: triangle then name */}
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
          <p className="font-semibold truncate">{ride.to}</p>
        </div>
      </div>

      {/* Departure + seats */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-foreground mt-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{formatDate(ride.date)} at {formatTime(ride.time)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          {available > 0 ? (
            <span>{available} {available === 1 ? "seat" : "seats"} left</span>
          ) : (
            <span className="text-destructive font-semibold">Seats full</span>
          )}
        </div>
      </div>
    </Link>
  );
}

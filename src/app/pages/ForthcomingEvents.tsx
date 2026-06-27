import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarDays, Clock, MapPin, Car } from "lucide-react";
import { fetchEvents, type EventItem } from "../data/events";

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ForthcomingEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents()
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Forthcoming Events</h1>
            <p className="text-muted-foreground">
              CA meetups and seminars — carpool with peers and earn reward points.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl h-28 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-card border border-primary rounded-xl p-10 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/15 rounded-full mb-4">
              <CalendarDays className="w-7 h-7 text-primary" />
            </div>
            <p className="font-semibold text-lg mb-1">No events scheduled yet</p>
            <p className="text-muted-foreground max-w-md mx-auto">
              Forthcoming CA events will appear here. They're also marked on the date picker when you
              search for or publish a ride.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((e) => (
              <div
                key={e.id}
                className="bg-card border border-primary rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Date badge */}
                <div className="shrink-0 w-full sm:w-28 text-center sm:border-r sm:pr-4">
                  <div className="text-sm font-semibold text-primary">{prettyDate(e.date)}</div>
                  {e.time && (
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      {e.time}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold">{e.title}</h2>
                  {e.location && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-4 h-4" />
                      {e.location}
                    </p>
                  )}
                  {e.description && <p className="text-sm mt-2">{e.description}</p>}
                </div>

                {/* Carpool CTA */}
                <Link
                  to={`/publish?to=${encodeURIComponent(e.location ?? "")}&date=${e.date}`}
                  className="shrink-0 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  <Car className="w-4 h-4" />
                  Carpool
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

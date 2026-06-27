import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { CalendarPlus, Trash2, Loader2, ShieldAlert, Clock, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchProfile } from "../data/profiles";
import { fetchAllEvents, createEvent, deleteEvent, type EventItem } from "../data/events";

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const EMPTY = { title: "", date: "", time: "", location: "", description: "" };

export function Admin() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }
    fetchProfile(user.id)
      .then((p) => setIsAdmin(Boolean(p?.is_admin)))
      .catch(() => setIsAdmin(false))
      .finally(() => setChecking(false));
  }, [user]);

  const loadEvents = () => fetchAllEvents().then(setEvents).catch(() => setEvents([]));

  useEffect(() => {
    if (isAdmin) loadEvents();
  }, [isAdmin]);

  if (loading || (user && checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Admins only</h1>
        <p className="text-muted-foreground max-w-md">
          You don't have permission to manage events. Contact an administrator if you think this is
          a mistake.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    if (!form.title.trim() || !form.date) {
      setMsg("Title and date are required.");
      return;
    }
    setSaving(true);
    try {
      await createEvent({
        title: form.title.trim(),
        date: form.date,
        time: form.time.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
      });
      setForm(EMPTY);
      setMsg("Event published!");
      loadEvents();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not publish event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await deleteEvent(id);
      loadEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete event");
    }
  };

  const todayStr = todayLocal();

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full">
            <CalendarPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin · Events</h1>
            <p className="text-muted-foreground">
              Publish forthcoming events — they appear on the Forthcoming Events page and date
              pickers.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Create form */}
          <div className="bg-card border border-primary rounded-xl p-6 h-fit">
            <h2 className="text-lg font-semibold mb-4">Publish an event</h2>
            {msg && (
              <div
                className={`mb-4 text-sm rounded-lg p-3 ${
                  msg === "Event published!"
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {msg}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. ICAI CPE Seminar"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    min={todayStr}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Time</label>
                  <input
                    type="text"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    placeholder="10:00 AM"
                    className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Venue, city"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What's the event about?"
                  rows={3}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Publishing…" : "Publish event"}
              </button>
            </form>
          </div>

          {/* Existing events */}
          <div>
            <h2 className="text-lg font-semibold mb-4">All events ({events.length})</h2>
            {events.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                No events yet. Publish one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((e) => {
                  const isPast = e.date < todayStr;
                  return (
                    <div
                      key={e.id}
                      className={`bg-card border rounded-xl p-4 flex items-start justify-between gap-3 ${
                        isPast ? "border-border opacity-60" : "border-primary"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{e.title}</h3>
                          {isPast && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              Past
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1">
                            {prettyDate(e.date)}
                          </span>
                          {e.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {e.time}
                            </span>
                          )}
                          {e.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {e.location}
                            </span>
                          )}
                        </div>
                        {e.description && <p className="text-sm mt-2">{e.description}</p>}
                      </div>
                      <button
                        onClick={() => handleDelete(e.id)}
                        aria-label="Delete event"
                        className="shrink-0 p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { CalendarPlus, Trash2, Loader2, ShieldAlert, Clock, MapPin, Pencil, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchProfile } from "../data/profiles";
import {
  fetchAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  type EventItem,
} from "../data/events";
import { PlaceAutocomplete } from "../components/PlaceAutocomplete";
import { EventDatePicker } from "../components/EventDatePicker";
import { AdminRides } from "../components/AdminRides";
import { EmptyState } from "../components/EmptyState";
import { btn } from "../lib/ui";

// One filled field style for the whole form, matching the hero search card
// rather than the default bordered inputs.
const adminField =
  "w-full py-2.5 px-4 text-sm bg-muted/40 border border-transparent rounded-xl " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 " +
  "focus:ring-primary/60 focus:bg-card transition-colors";
const adminLabel = "block text-xs font-medium text-muted-foreground mb-1.5";

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

  const [tab, setTab] = useState<"events" | "rides">("events");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [form, setForm] = useState(EMPTY);
  // null = the form creates a new event; an id = it's editing that one.
  const [editingId, setEditingId] = useState<string | null>(null);
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
      const payload = {
        title: form.title.trim(),
        date: form.date,
        time: form.time.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
      };
      if (editingId) {
        await updateEvent(editingId, payload);
        setMsg("Event updated!");
      } else {
        await createEvent(payload);
        setMsg("Event published!");
      }
      setForm(EMPTY);
      setEditingId(null);
      loadEvents();
    } catch (err) {
      setMsg(
        err instanceof Error
          ? err.message
          : editingId
            ? "Could not update event"
            : "Could not publish event"
      );
    } finally {
      setSaving(false);
    }
  };

  /** Load an event into the form for editing. */
  const startEdit = (e: EventItem) => {
    setEditingId(e.id);
    setMsg("");
    setForm({
      title: e.title,
      date: e.date,
      time: e.time ?? "",
      location: e.location ?? "",
      description: e.description ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY);
    setMsg("");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await deleteEvent(id);
      if (editingId === id) cancelEdit(); // don't leave the form editing a gone event
      loadEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete event");
    }
  };

  const isSuccess = msg === "Event published!" || msg === "Event updated!";

  const todayStr = todayLocal();

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full">
            <CalendarPlus className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="text-muted-foreground">
              {tab === "events"
                ? "Publish forthcoming events — they appear on the Forthcoming Events page and date pickers."
                : "Moderate published rides and see who has booked a seat."}
            </p>
          </div>
        </div>

        {/* Section switcher */}
        <div className="inline-flex items-center gap-1 bg-muted/60 border border-border rounded-full p-1 mb-6">
          {([
            { key: "events", label: "Events" },
            { key: "rides", label: "Rides" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "rides" ? (
          <AdminRides />
        ) : (
        /* The form used to be a tall 380px column beside the list, which
           pushed the page well past the fold. As a full-width bar its fields
           fit on two rows, and the list starts much higher up. */
        <div className="space-y-6">
          {/* Create / edit form */}
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm md:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit event" : "Publish an event"}
              </h2>
              {editingId && (
                <button type="button" onClick={cancelEdit} className={btn("ghost", "sm")}>
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              )}
            </div>
            {msg && (
              <div
                className={`mb-4 text-sm rounded-lg p-3 ${
                  isSuccess
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {msg}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="lg:col-span-2">
                  <label className={adminLabel}>Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. ICAI CPE Seminar"
                    className={adminField}
                    required
                  />
                </div>
                <div>
                  <label className={adminLabel}>Date</label>
                  {/* The app's own picker, not a bare <input type="date"> —
                      it matches the rest of the app and marks event days. */}
                  <EventDatePicker
                    value={form.date}
                    onChange={(d) => setForm({ ...form, date: d })}
                    // Editing a past event must not be blocked by the
                    // "no events in the past" rule that applies to new ones.
                    min={editingId && form.date < todayStr ? form.date : todayStr}
                    className={adminField}
                  />
                </div>
                <div>
                  <label className={adminLabel}>Time</label>
                  <input
                    type="text"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    placeholder="10:00 AM"
                    className={adminField}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={adminLabel}>Location</label>
                  <PlaceAutocomplete
                    value={form.location}
                    onChange={(text) => setForm({ ...form, location: text })}
                    onSelect={({ label }) => setForm({ ...form, location: label })}
                    placeholder="Venue, city"
                    className={adminField}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={adminLabel}>Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What's the event about?"
                    className={adminField}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end border-t border-border/60 pt-4">
                <button type="submit" disabled={saving} className={btn("primary")}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving
                    ? editingId
                      ? "Saving…"
                      : "Publishing…"
                    : editingId
                      ? "Save changes"
                      : "Publish event"}
                </button>
              </div>
            </form>
          </div>

          {/* Existing events */}
          <div>
            <h2 className="text-lg font-semibold mb-4">All events ({events.length})</h2>
            {events.length === 0 ? (
              <EmptyState
                title="No events yet"
                body="Publish one with the form above and it will appear here, on Forthcoming Events, and in the ride date pickers."
                preview={null}
              />
            ) : (
              <div className="space-y-3">
                {events.map((e) => {
                  const isPast = e.date < todayStr;
                  return (
                    <div
                      key={e.id}
                      className={`bg-card border rounded-xl p-4 flex items-start justify-between gap-3 ${
                        editingId === e.id
                          ? "border-primary ring-2 ring-primary/30"
                          : isPast
                            ? "border-border opacity-60"
                            : "border-primary"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold break-words">{e.title}</h3>
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
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(e)}
                          aria-label={`Edit ${e.title}`}
                          title="Edit event"
                          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          aria-label={`Delete ${e.title}`}
                          title="Delete event"
                          className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

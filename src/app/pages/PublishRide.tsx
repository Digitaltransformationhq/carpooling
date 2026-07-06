import { useState } from "react";
import { useNavigate, Navigate, useSearchParams } from "react-router";
import { MapPin, Calendar, Clock, Users, LocateFixed, Loader2, ChevronDown } from "lucide-react";
import { createRide } from "../data/rides";
import { detectCurrentLocation, type LatLng } from "../lib/geo";
import { PlaceAutocomplete } from "../components/PlaceAutocomplete";
import { EventDatePicker } from "../components/EventDatePicker";
import { useAuth } from "../context/AuthContext";

// local YYYY-MM-DD (today) — used as the earliest selectable date
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function PublishRide() {
  const navigate = useNavigate();
  const { user, loading, configured, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  // Exact coordinates captured when a place is picked from the dropdown / detected.
  const [fromCoords, setFromCoords] = useState<LatLng | null>(null);
  const [toCoords, setToCoords] = useState<LatLng | null>(null);
  // Pre-fill destination + date when arriving from a calendar event.
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    from: "",
    to: searchParams.get("to") ?? "",
    date: searchParams.get("date") ?? "",
    hour: "",
    minute: "",
    ampm: "AM",
    vehicleType: "4-wheeler" as "2-wheeler" | "4-wheeler",
    seats: "1",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date) {
      alert("Please select a travel date.");
      return;
    }
    setSubmitting(true);
    try {
      const ride = await createRide({
        from: formData.from.trim(),
        to: formData.to.trim(),
        date: formData.date,
        // store a 12-hour value (e.g. "7:05 PM") — what formatTime + search filtering expect
        time: `${formData.hour}:${formData.minute} ${formData.ampm}`,
        vehicleType: formData.vehicleType,
        seats: Number(formData.seats),
        fromCoords,
        toCoords,
      });
      refreshProfile(); // keep the navbar profile fresh (points are earned on completion)
      alert("Ride published successfully!");
      navigate(`/ride/${ride.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not publish ride");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleDetectLocation = async () => {
    setLocating(true);
    try {
      const { label, coords, accuracy } = await detectCurrentLocation();
      setFormData((f) => ({ ...f, from: label }));
      setFromCoords(coords);
      if (accuracy > 1000) {
        alert(
          `Your location was only accurate to ~${Math.round(accuracy / 1000)} km ` +
            `(this device has no GPS). Please double-check or edit the "Leaving from" field.`
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not determine your location");
    } finally {
      setLocating(false);
    }
  };

  // Must be signed in to publish, so the ride is tied to your account
  // (and shows up under "My Rides").
  if (configured && !loading && !user) {
    return <Navigate to="/login" replace />;
  }

  const minDate = todayLocal();

  return (
    <div className="min-h-screen bg-muted/30 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card border border-primary rounded-xl shadow-lg p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-2">Publish a Ride</h1>
          <p className="text-muted-foreground mb-8">
            Share your journey and offer rides to fellow travelers
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Route Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Route Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="w-4 h-4" />
                      Leaving from
                    </label>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={locating}
                      className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60"
                    >
                      {locating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LocateFixed className="w-3.5 h-3.5" />
                      )}
                      {locating ? "Detecting…" : "Use my location"}
                    </button>
                  </div>
                  <PlaceAutocomplete
                    name="from"
                    value={formData.from}
                    onChange={(text) => {
                      setFormData((f) => ({ ...f, from: text }));
                      setFromCoords(null);
                    }}
                    onSelect={({ label, coords }) => {
                      setFormData((f) => ({ ...f, from: label }));
                      setFromCoords(coords);
                    }}
                    placeholder="City, address, station..."
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4" />
                    Going to
                  </label>
                  <PlaceAutocomplete
                    name="to"
                    value={formData.to}
                    onChange={(text) => {
                      setFormData((f) => ({ ...f, to: text }));
                      setToCoords(null);
                    }}
                    onSelect={({ label, coords }) => {
                      setFormData((f) => ({ ...f, to: label }));
                      setToCoords(coords);
                    }}
                    placeholder="City, address, station..."
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="w-4 h-4" />
                    Date
                  </label>
                  <EventDatePicker
                    value={formData.date}
                    onChange={(d) => setFormData((f) => ({ ...f, date: d }))}
                    min={minDate}
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    Departure time
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <select
                        name="hour"
                        value={formData.hour}
                        onChange={handleChange}
                        aria-label="Hour"
                        className="w-full appearance-none pl-3 pr-8 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      >
                        <option value="" disabled>
                          Hour
                        </option>
                        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="relative">
                      <select
                        name="minute"
                        value={formData.minute}
                        onChange={handleChange}
                        aria-label="Minute"
                        className="w-full appearance-none pl-3 pr-8 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      >
                        <option value="" disabled>
                          Min
                        </option>
                        {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map(
                          (mm) => (
                            <option key={mm} value={mm}>
                              {mm}
                            </option>
                          )
                        )}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="relative">
                      <select
                        name="ampm"
                        value={formData.ampm}
                        onChange={handleChange}
                        aria-label="AM or PM"
                        className="w-full appearance-none pl-3 pr-8 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ride Details */}
            <div className="space-y-4 pt-6 border-t">
              <h2 className="text-xl font-semibold">Ride Details</h2>

              {/* Available seats */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Users className="w-4 h-4" />
                  Available seats
                </label>
                <div className="relative">
                  <select
                    name="seats"
                    value={formData.seats}
                    onChange={handleChange}
                    className="w-full appearance-none pl-4 pr-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="1">1 seat</option>
                    <option value="2">2 seats</option>
                    <option value="3">3 seats</option>
                    <option value="4">4 seats</option>
                    <option value="5">5 seats</option>
                    <option value="6">6 seats</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground py-4 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {submitting ? "Publishing…" : "Publish Ride"}
              </button>
              <p className="text-sm text-muted-foreground text-center mt-4">
                By publishing, you agree to our terms and conditions
              </p>
            </div>
          </form>
        </div>

        {/* Tips Section */}
        <div className="mt-8 bg-primary/10 border border-primary/20 rounded-xl p-6">
          <h3 className="font-semibold mb-3">Tips for a successful ride</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Be clear about pickup and drop-off locations</li>
            <li>• Update your ride details if plans change</li>
            <li>• Communicate with passengers before the trip</li>
            <li>• Keep your vehicle clean and comfortable</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

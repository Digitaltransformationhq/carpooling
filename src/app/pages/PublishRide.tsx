import { useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { MapPin, Calendar, Clock, Users, Car, Bike } from "lucide-react";
import { createRide } from "../data/rides";
import { LocationInput } from "../components/LocationInput";
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
  const { user, loading, configured } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    from: "",
    to: "",
    date: "",
    time: "",
    vehicleType: "4-wheeler" as "2-wheeler" | "4-wheeler",
    seats: "1",
  });

  const isTwoWheeler = formData.vehicleType === "2-wheeler";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ride = await createRide({
        from: formData.from.trim(),
        to: formData.to.trim(),
        date: formData.date,
        time: formData.time,
        vehicleType: formData.vehicleType,
        seats: isTwoWheeler ? 1 : Number(formData.seats),
      });
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

  const setField = (name: "from" | "to", value: string) =>
    setFormData((f) => ({ ...f, [name]: value }));

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
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4" />
                    Leaving from
                  </label>
                  <LocationInput
                    value={formData.from}
                    onChange={(v) => setField("from", v)}
                    required
                    showCurrentLocation
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4" />
                    Going to
                  </label>
                  <LocationInput
                    value={formData.to}
                    onChange={(v) => setField("to", v)}
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
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    min={minDate}
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    Departure time
                  </label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Ride Details */}
            <div className="space-y-4 pt-6 border-t">
              <h2 className="text-xl font-semibold">Ride Details</h2>

              {/* Vehicle type */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Vehicle type</span>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((f) => ({ ...f, vehicleType: "2-wheeler", seats: "1" }))
                    }
                    className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg font-medium transition-colors ${
                      isTwoWheeler
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Bike className="w-5 h-5" />
                    2-Wheeler
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, vehicleType: "4-wheeler" }))}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg font-medium transition-colors ${
                      !isTwoWheeler
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Car className="w-5 h-5" />
                    4-Wheeler
                  </button>
                </div>
              </div>

              {/* Available seats */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Users className="w-4 h-4" />
                  Available seats
                </label>
                {isTwoWheeler ? (
                  <>
                    <input
                      type="text"
                      value="1 seat"
                      disabled
                      className="w-full px-4 py-3 border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      A two-wheeler can carry one passenger.
                    </p>
                  </>
                ) : (
                  <select
                    name="seats"
                    value={formData.seats}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="1">1 seat</option>
                    <option value="2">2 seats</option>
                    <option value="3">3 seats</option>
                    <option value="4">4 seats</option>
                  </select>
                )}
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

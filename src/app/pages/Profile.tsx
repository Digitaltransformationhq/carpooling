import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { MapPin, Calendar, Edit2, Car, Camera, Award } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
  type Profile as DBProfile,
} from "../data/profiles";
import { fetchUserStats, fetchMyTrips, type UserStats, type Trip } from "../data/account";
import { deleteRide, markRideComplete, markRideStarted } from "../data/rides";
import { formatDate } from "../lib/format";

const AVATAR = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop";

export function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"rides" | "settings">("rides");
  const { user: authUser, loading, configured, refreshProfile } = useAuth();

  const [profile, setProfile] = useState<DBProfile | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", membership_id: "" });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [stats, setStats] = useState<UserStats>({
    ridesAsDriver: 0,
    ridesAsPassenger: 0,
    points: 0,
  });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [avatarUrl, setAvatarUrl] = useState(AVATAR);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authUser) return;
    fetchProfile(authUser.id)
      .then((p) => {
        const fullName =
          p?.full_name ?? (authUser.user_metadata?.full_name as string) ?? "";
        setProfile(p);
        setForm({
          full_name: fullName,
          phone: p?.phone ?? "",
          membership_id: p?.membership_id ?? "",
        });
        if (p?.avatar_url) setAvatarUrl(p.avatar_url);
      })
      .catch(() => {
        setForm((f) => ({
          ...f,
          full_name: (authUser.user_metadata?.full_name as string) ?? "",
        }));
      });

    fetchUserStats(authUser.id).then(setStats).catch(() => {});
    fetchMyTrips(authUser.id).then(setTrips).catch(() => {});
  }, [authUser]);

  if (configured && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (configured && !authUser) {
    return <Navigate to="/login" replace />;
  }

  const displayName =
    form.full_name || profile?.full_name || authUser?.email?.split("@")[0] || "Aarav Sharma";
  const email = authUser?.email || "aarav.sharma@email.com";
  const memberSince = authUser?.created_at
    ? new Date(authUser.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "January 2024";
  const verified = Boolean(authUser?.email_confirmed_at) || !configured;

  const todayStr = new Date().toISOString().slice(0, 10);

  const reloadTrips = () => {
    if (authUser) fetchMyTrips(authUser.id).then(setTrips).catch(() => {});
  };

  const handleStart = async (rideId: string) => {
    try {
      await markRideStarted(rideId);
      reloadTrips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update ride");
    }
  };

  const handleComplete = async (rideId: string) => {
    try {
      await markRideComplete(rideId);
      reloadTrips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update ride");
    }
  };

  const handleRemove = async (rideId: string) => {
    if (!window.confirm("Remove this published ride?")) return;
    try {
      await deleteRide(rideId);
      reloadTrips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove ride");
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(authUser.id, file);
      setAvatarUrl(url);
      refreshProfile();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!authUser) {
      setSavedMsg("Sign in to save your profile.");
      return;
    }
    setSaving(true);
    setSavedMsg("");
    try {
      const updated = await updateProfile(authUser.id, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        membership_id: form.membership_id.trim(),
      });
      setProfile(updated);
      setSavedMsg("Profile saved!");
      refreshProfile();
    } catch (err) {
      setSavedMsg(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="bg-card border border-primary rounded-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative w-24 h-24 shrink-0">
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="Change photo"
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary border-2 border-card flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Camera className="w-4 h-4 text-primary-foreground" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white text-xs">
                  …
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                {verified && (
                  <span className="px-3 py-1 bg-primary/20 text-foreground text-sm rounded-full">
                    Verified
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">Member since {memberSince}</p>
            </div>
            <button
              onClick={() => setActiveTab("settings")}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.ridesAsDriver}</div>
              <div className="text-sm text-muted-foreground">Rides as Driver</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.ridesAsPassenger}</div>
              <div className="text-sm text-muted-foreground">Rides as Passenger</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-1.5 text-primary">
                <Award className="w-6 h-6" />
                {stats.points}
              </div>
              <div className="text-sm text-muted-foreground">Reward Points</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Earn <span className="font-medium text-foreground">2 points</span> for publishing a ride
            and <span className="font-medium text-foreground">1 point</span> for joining one.
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-card border border-primary rounded-xl overflow-hidden">
          <div className="border-b">
            <div className="flex">
              {(["rides", "settings"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-6 py-4 font-medium transition-colors capitalize ${
                    activeTab === tab
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "rides" ? "My Rides" : tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === "rides" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">My Rides</h2>
                  {trips.length === 0 ? (
                    <p className="text-muted-foreground">
                      No rides yet. Publish a ride or book a seat and it'll show up here.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {trips.map((trip) => {
                        const isCompleted = trip.completed || trip.date < todayStr;
                        const isStarted = trip.started && !isCompleted;
                        const statusLabel = isCompleted
                          ? "Completed"
                          : isStarted
                          ? "On the way"
                          : "Upcoming";
                        const statusClass = isCompleted
                          ? "bg-muted text-muted-foreground"
                          : isStarted
                          ? "bg-green-100 text-green-700"
                          : "bg-primary/20 text-foreground";
                        return (
                          <div
                            key={trip.key}
                            onClick={() => trip.rideId && navigate(`/ride/${trip.rideId}`)}
                            role={trip.rideId ? "button" : undefined}
                            tabIndex={trip.rideId ? 0 : undefined}
                            onKeyDown={(e) => {
                              if (trip.rideId && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                navigate(`/ride/${trip.rideId}`);
                              }
                            }}
                            className={`border border-border rounded-lg p-4 ${
                              trip.rideId
                                ? "cursor-pointer transition-all hover:border-primary hover:shadow-md hover:shadow-primary/10"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                {trip.type === "driver" ? (
                                  <Car className="w-4 h-4 text-primary" />
                                ) : (
                                  <MapPin className="w-4 h-4 text-primary" />
                                )}
                                <span className="font-medium">
                                  {trip.type === "driver" ? "Driving" : "Passenger"}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass}`}>
                                  {statusLabel}
                                </span>
                              </div>
                              <span className="text-sm text-muted-foreground flex items-center gap-1 shrink-0">
                                <Calendar className="w-4 h-4" />
                                {formatDate(trip.date)}
                              </span>
                            </div>

                            {/* Route */}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold truncate">{trip.from}</span>
                                <span className="w-5 h-5 rounded-[4px] bg-primary flex items-center justify-center shrink-0">
                                  <span className="w-2 h-2 rounded-[1px] bg-white"></span>
                                </span>
                              </div>
                              <div
                                className={`flex-1 h-[3px] ${isCompleted ? "route-still" : "route-flow"}`}
                                aria-hidden="true"
                              ></div>
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
                                <span className="font-semibold truncate">{trip.to}</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                              <p className="text-sm text-muted-foreground">{trip.detail}</p>
                              {trip.type === "driver" && trip.rideId && (
                                <div className="flex items-center gap-2">
                                  {!isCompleted && !isStarted && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStart(trip.rideId!);
                                      }}
                                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-primary hover:bg-primary/10 transition-colors"
                                    >
                                      Start ride
                                    </button>
                                  )}
                                  {!isCompleted && isStarted && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleComplete(trip.rideId!);
                                      }}
                                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-primary hover:bg-primary/10 transition-colors"
                                    >
                                      Mark complete
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemove(trip.rideId!);
                                    }}
                                    className="text-xs font-medium px-3 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Edit Profile</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Membership ID</label>
                      <input
                        type="text"
                        value={form.membership_id}
                        onChange={(e) => setForm({ ...form, membership_id: e.target.value })}
                        placeholder="e.g. 123456"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Full name</label>
                      <input
                        type="text"
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        placeholder="Your name"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Email</label>
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full px-4 py-2 border rounded-lg bg-muted/50 text-muted-foreground cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Your login email can't be changed here.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Phone</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  {savedMsg && (
                    <p
                      className={`text-sm mb-3 ${
                        savedMsg === "Profile saved!" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {savedMsg}
                    </p>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

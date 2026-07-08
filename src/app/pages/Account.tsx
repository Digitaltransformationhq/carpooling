import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Camera, Award, Car, MapPin, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
  type Profile as DBProfile,
} from "../data/profiles";
import { fetchUserStats, type UserStats } from "../data/account";

const AVATAR = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop";

export function Account() {
  const navigate = useNavigate();
  const { user: authUser, loading, configured, refreshProfile, signOut, profile: authProfile } =
    useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const [profile, setProfile] = useState<DBProfile | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", membership_id: "" });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [stats, setStats] = useState<UserStats>({
    ridesAsDriver: 0,
    ridesAsPassenger: 0,
    points: 0,
  });
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
      // Supabase throws a PostgrestError (plain object, not an Error), so read
      // .message off whatever shape we got instead of masking it.
      console.error("Profile save failed:", err);
      const msg =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
            ? (err as { message: string }).message
            : "Could not save profile";
      setSavedMsg(
        /duplicate|unique/i.test(msg)
          ? "That Membership ID is already registered. Please check and try again."
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  const stat = [
    { label: "Rides as Driver", value: stats.ridesAsDriver, icon: Car, accent: false },
    { label: "Rides as Passenger", value: stats.ridesAsPassenger, icon: MapPin, accent: false },
    {
      label: "Reward Points",
      value: authProfile?.points ?? stats.points,
      icon: Award,
      accent: true,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Profile Header */}
        <div className="bg-card border border-primary rounded-2xl p-6 md:p-8">
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
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            {stat.map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className={`text-2xl font-bold flex items-center justify-center gap-1.5 ${
                    s.accent ? "text-primary" : ""
                  }`}
                >
                  {s.accent && <Award className="w-6 h-6" />}
                  {s.value}
                </div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Earn <span className="font-medium text-foreground">2 points</span> when a ride you drove
            is completed and <span className="font-medium text-foreground">1 point</span> for each
            completed ride you join.
          </p>
        </div>

        {/* Edit Profile */}
        <div className="bg-card border border-primary rounded-2xl p-6 md:p-8">
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
      </div>
    </div>
  );
}

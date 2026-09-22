import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Camera, Award, Car, MapPin, LogOut, BadgeCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
  type Profile as DBProfile,
} from "../data/profiles";
import { fetchUserStats, type UserStats } from "../data/account";
import { RideAlertsSettings } from "../components/RideAlerts";
import { Avatar } from "../components/Avatar";
import { btn } from "../lib/ui";

// One filled field style for the form, matching the hero search card and the
// admin form rather than the default bordered inputs.
const accountField =
  "w-full py-2.5 px-4 text-sm bg-muted/40 border border-transparent rounded-xl " +
  "placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 " +
  "focus:ring-primary/60 focus:bg-card transition-colors";
const accountLabel = "block text-xs font-medium text-muted-foreground mb-1.5";

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
  const [avatarUrl, setAvatarUrl] = useState("");
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Your account</h1>

        {/* Two columns so identity and settings sit side by side instead of
            stacking into one long scroll. Deliberately NOT sticky — pinning
            the left panel makes the page feel like two separate scroll
            regions. The whole page scrolls as one. */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ---------- identity ---------- */}
          <aside className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="relative h-24 w-24 shrink-0">
                <Avatar src={avatarUrl} name={displayName} className="h-24 w-24" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change photo"
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  <Camera className="h-4 w-4 text-primary-foreground" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs text-white">
                    …
                  </div>
                )}
              </div>

              <h2 className="mt-4 w-full truncate text-lg font-semibold" title={displayName}>
                {displayName}
              </h2>
              {verified && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                  <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                  Verified
                </span>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Member since {memberSince}</p>
            </div>

            {/* Labelled rows, not three columns — "Rides as Passenger" would
                squash to two cramped lines in a 320px panel. */}
            <dl className="mt-6 space-y-1 border-t border-border/60 pt-4">
              {stat.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3 py-1.5">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <s.icon
                      className={`h-4 w-4 ${s.accent ? "text-primary" : "text-muted-foreground"}`}
                    />
                    {s.label}
                  </dt>
                  <dd className={`text-base font-bold ${s.accent ? "text-primary" : ""}`}>
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
              Earn <span className="font-semibold text-foreground">2 points</span> when a ride you
              drove is completed, and{" "}
              <span className="font-semibold text-foreground">1 point</span> for each completed ride
              you join.
            </p>

            <button onClick={handleSignOut} className={`${btn("danger", "sm")} mt-4 w-full`}>
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </aside>

          {/* ---------- settings ---------- */}
          <div className="space-y-6">
            <RideAlertsSettings />

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
              <h2 className="text-lg font-semibold">Edit profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your name and photo appear on rides you publish.
              </p>

              {/* Two fields per row — four stacked full-width inputs was most
                  of this page's scrolling. */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={accountLabel}>Membership ID</label>
                  <input
                    type="text"
                    value={form.membership_id}
                    onChange={(e) => setForm({ ...form, membership_id: e.target.value })}
                    placeholder="e.g. 123456"
                    className={accountField}
                  />
                </div>
                <div>
                  <label className={accountLabel}>Full name</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Your name"
                    className={accountField}
                  />
                </div>
                <div>
                  <label className={accountLabel}>Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className={accountField}
                  />
                </div>
                <div>
                  <label className={accountLabel}>Email</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className={`${accountField} cursor-not-allowed opacity-70`}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Your login email can't be changed here.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-5">
                {savedMsg && (
                  <p
                    className={`mr-auto text-sm ${
                      savedMsg === "Profile saved!" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {savedMsg}
                  </p>
                )}
                <button onClick={handleSave} disabled={saving} className={btn("primary")}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

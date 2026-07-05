import { useEffect, useState } from "react";
import { BadgeCheck, Mail, Phone, User as UserIcon, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchProfile, updateProfile } from "../data/profiles";

/**
 * Shown once, over whatever page a member lands on, the first time they sign in
 * (e.g. via Google) before their profile is complete. Collects the CA's
 * Membership ID and phone; name + email are auto-filled from the account.
 * Disappears as soon as both required fields are saved.
 */
export function CompleteProfileModal() {
  const { user, configured, refreshProfile } = useAuth();
  const [needed, setNeeded] = useState(false);
  const [form, setForm] = useState({ membership_id: "", full_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const email = user?.email ?? "";

  useEffect(() => {
    if (!configured || !user) {
      setNeeded(false);
      return;
    }
    fetchProfile(user.id)
      .then((p) => {
        // admins don't need the member onboarding form
        const complete = Boolean(p?.is_admin) || Boolean(p?.membership_id && p?.phone);
        setForm({
          membership_id: p?.membership_id ?? "",
          full_name:
            p?.full_name ||
            (user.user_metadata?.full_name as string) ||
            (user.user_metadata?.name as string) ||
            "",
          phone: p?.phone ?? "",
        });
        setNeeded(!complete);
      })
      .catch(() => setNeeded(false));
  }, [user, configured]);

  if (!needed || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateProfile(user.id, {
        membership_id: form.membership_id.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
      });
      await refreshProfile();
      setNeeded(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save your details";
      if (/duplicate|unique/i.test(msg)) {
        setError("That Membership ID is already registered. Please check and try again.");
      } else if (/permission denied|column .*membership_id/i.test(msg)) {
        // The DB column allow-list doesn't grant membership_id yet.
        setError(
          "Saving is blocked by the database. An admin needs to run supabase/membership.sql in Supabase to enable Membership ID."
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-md bg-card border border-primary rounded-2xl shadow-xl p-6 md:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="bg-primary/15 text-primary p-3 rounded-xl mb-3">
            <BadgeCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold">Complete your profile</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome! Add your CA details to finish setting up your account.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Membership ID</label>
            <div className="relative">
              <BadgeCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={form.membership_id}
                onChange={(e) => setForm({ ...form, membership_id: e.target.value })}
                placeholder="e.g. 123456"
                required
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Full name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Your name"
                required
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                disabled
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg bg-muted/50 text-muted-foreground cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground">Fetched from your account.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mobile number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
                required
                pattern="[0-9+\-\s()]{7,}"
                title="Enter a valid mobile number"
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

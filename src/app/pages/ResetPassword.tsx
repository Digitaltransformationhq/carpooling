import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";

/**
 * What the browser arrived with, captured at module load: supabase-js strips
 * the recovery token out of the URL as soon as it has parsed it, which can
 * happen before this component mounts. Without this snapshot we couldn't tell
 * "came from a reset email" apart from "typed the URL in by hand".
 */
const ARRIVAL = (() => {
  if (typeof window === "undefined") return { token: false, error: "" };
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return {
    token:
      hash.get("type") === "recovery" ||
      Boolean(hash.get("access_token")) ||
      Boolean(query.get("code")),
    // Supabase reports an expired or already-used link this way.
    error: hash.get("error_description") || query.get("error_description") || "",
  };
})();

/**
 * Where the emailed recovery link lands. The link itself points at Supabase,
 * which verifies and burns the one-time token server-side before redirecting
 * here with a short-lived session — so this page is inert to anyone who just
 * types the URL. The password change is authorised from that session's JWT,
 * meaning it can only ever affect the member who received the email.
 */
export function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword, signOut, configured } = useAuth();
  const { openLogin } = useAuthModal();

  const [status, setStatus] = useState<"checking" | "valid" | "invalid">(
    ARRIVAL.error ? "invalid" : "checking"
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(ARRIVAL.error);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase || ARRIVAL.error) {
      if (!supabase) setStatus("invalid");
      return;
    }
    const client = supabase;
    let cancelled = false;

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (cancelled || !ARRIVAL.token) return;
      if (event === "PASSWORD_RECOVERY" || session) setStatus("valid");
    });

    // The recovery event can fire before this effect attaches, so also check
    // for a session that's already been exchanged.
    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!ARRIVAL.token) setStatus("invalid");
      else if (data.session) setStatus("valid");
      // Token present but not exchanged yet — the listener above will catch it.
    });

    // Backstop: a malformed token that never resolves shouldn't spin forever.
    const giveUp = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Both passwords must match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      // Don't leave the recovery session behind — on a shared device the link
      // could be reopened from history and would otherwise still be signed in.
      await signOut();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  };

  const goSignIn = () => {
    navigate("/", { replace: true });
    openLogin();
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-card border border-primary rounded-2xl shadow-xl shadow-primary/5 p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src="/logo.png"
            alt="CACommute"
            className="w-16 h-16 rounded-xl object-cover mb-3"
          />
          <h1 className="text-2xl font-bold">
            {done ? "Password updated" : "Set a new password"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {done
              ? "You can now sign in with your new password."
              : "Choose a new password for your CACommute account."}
          </p>
        </div>

        {!configured && (
          <div className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
            Supabase isn't connected yet, so passwords can't be changed.
          </div>
        )}

        {status === "checking" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking your reset link…
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center">
            <div className="flex items-start gap-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-left">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                {error || "This reset link is invalid or has expired."} Request a new one from
                the sign-in form — links can only be used once, and expire after a short while.
              </span>
            </div>
            <button
              type="button"
              onClick={goSignIn}
              className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        )}

        {status === "valid" && done && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg p-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              Your password has been changed.
            </div>
            <button
              type="button"
              onClick={goSignIn}
              className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Sign in
            </button>
          </div>
        )}

        {status === "valid" && !done && (
          <>
            {error && (
              <div className="mb-4 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">At least 6 characters.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Confirm new password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !configured}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

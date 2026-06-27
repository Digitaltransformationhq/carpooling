import { useState } from "react";
import { useNavigate } from "react-router";
import { ShieldCheck, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchProfile } from "../data/profiles";

export function AdminLogin() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, signOut, configured } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /** After auth, allow through only if the account is an admin. */
  const verifyAdmin = async () => {
    const { data } = await supabase!.auth.getUser();
    const uid = data.user?.id;
    const profile = uid ? await fetchProfile(uid) : null;
    if (profile?.is_admin) {
      navigate("/admin");
    } else {
      await signOut();
      setError("This account doesn't have admin access.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
      await verifyAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setBusy(true);
    try {
      // returns to /admin, which re-checks admin access after Google auth.
      await signInWithGoogle("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in with Google");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card border border-primary rounded-2xl shadow-xl shadow-primary/5 p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-primary text-primary-foreground p-3 rounded-xl mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold">Admin Sign In</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Restricted to approved administrators only
            </p>
          </div>

          {!configured && (
            <div className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
              Supabase isn't connected yet. Add your keys to <code>.env</code> and restart the dev
              server.
            </div>
          )}

          {error && (
            <div className="mb-4 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy || !configured}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-lg py-2.5 font-medium hover:bg-accent transition-colors disabled:opacity-60 mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <span className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Sign in as admin"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

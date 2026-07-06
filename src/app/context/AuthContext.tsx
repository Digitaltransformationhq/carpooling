import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export interface ProfileLite {
  full_name: string | null;
  avatar_url: string | null;
  points: number;
  is_admin: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  profile: ProfileLite | null;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string
  ) => Promise<{ needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<void>;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, points, is_admin")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as ProfileLite) ?? null);
  }, [userId]);

  // load the profile whenever the signed-in user changes
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Points can change from actions elsewhere (publishing a ride, a driver
  // accepting your request). Profiles aren't in the realtime publication, so
  // refetch when the tab regains focus/visibility to keep the points badge
  // current without a manual reload.
  useEffect(() => {
    if (!supabase) return;
    const refresh = () => {
      if (document.visibilityState === "visible") refreshProfile();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshProfile]);

  // Live updates: refetch this user's profile the instant their row changes
  // (points awarded on completion, an accepted request, etc.) — no refresh.
  useEffect(() => {
    if (!supabase || !userId) return;
    const client = supabase;
    const channel = client
      .channel(`profile-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => refreshProfile()
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [userId, refreshProfile]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase isn't connected.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    if (!supabase) throw new Error("Supabase isn't connected.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });
    if (error) throw error;
    // No session means Supabase requires email confirmation before sign-in.
    return { needsConfirmation: !data.session };
  };

  const resendConfirmation = async (email: string) => {
    if (!supabase) throw new Error("Supabase isn't connected.");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw error;
  };

  const signInWithGoogle = async (redirectPath = "/profile") => {
    if (!supabase) throw new Error("Supabase isn't connected.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // come back to the app after Google auth; the complete-profile form
      // (for first-time members) appears over whatever page they land on.
      options: { redirectTo: `${window.location.origin}${redirectPath}` },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        configured: isSupabaseConfigured,
        profile,
        refreshProfile,
        signIn,
        signUp,
        resendConfirmation,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

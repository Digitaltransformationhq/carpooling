import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { Search, Users, Phone, Mail, Award, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { searchProfiles } from "../data/profiles";
import type { DirectoryProfile } from "../data/profiles";

const AVATAR = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop";

function memberSince(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function PeerConnect() {
  const { user, loading, configured } = useAuth();
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<DirectoryProfile[]>([]);
  const [searching, setSearching] = useState(true);

  // Debounced directory search — re-runs as the query changes.
  useEffect(() => {
    if (configured && !user) return;
    setSearching(true);
    const handle = setTimeout(() => {
      searchProfiles(query, user?.id)
        .then(setMembers)
        .catch(() => setMembers([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, user, configured]);

  if (configured && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (configured && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Peer Connect</h1>
          <p className="text-muted-foreground mt-1">
            Find and connect with fellow CAs registered on the platform.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members by name or membership ID..."
            className="w-full pl-12 pr-4 py-3 rounded-full bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-transparent transition-shadow"
          />
        </div>

        {/* Results */}
        {searching ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Searching members…
          </div>
        ) : members.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-full mb-4">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <p className="font-semibold text-lg mb-1">No members found</p>
            <p className="text-muted-foreground">
              {query.trim()
                ? `No CA matches "${query.trim()}". Try a different name.`
                : "No other members are registered yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {members.map((m) => (
              <div
                key={m.id}
                className="group bg-card border border-border/60 rounded-2xl p-6 flex flex-col items-center text-center transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5"
              >
                <img
                  src={m.avatar_url || AVATAR}
                  alt={m.full_name ?? "Member"}
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/10 ring-offset-2 ring-offset-card"
                />
                <h2 className="font-semibold text-lg mt-4 truncate max-w-full">{m.full_name}</h2>
                {m.membership_id && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ICAI ID · {m.membership_id}
                  </p>
                )}

                <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Award className="w-3.5 h-3.5" />
                  {m.points} points
                </span>

                {m.created_at && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Member since {memberSince(m.created_at)}
                  </p>
                )}

                {m.bio && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{m.bio}</p>
                )}

                <div className="flex items-center gap-2 mt-5 w-full">
                  {m.phone || m.email ? (
                    <>
                      {m.phone && (
                        <a
                          href={`tel:${m.phone}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-muted/60 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          Call
                        </a>
                      )}
                      {m.email && (
                        <a
                          href={`mailto:${m.email}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-muted/60 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          Email
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="w-full text-xs text-muted-foreground py-2">
                      No contact details shared
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

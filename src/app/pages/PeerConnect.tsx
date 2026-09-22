import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { Search, Phone, Mail, Award, Loader2, EyeOff, Undo2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { searchProfiles, setMemberVisibility } from "../data/profiles";
import type { DirectoryProfile } from "../data/profiles";
import { Avatar } from "../components/Avatar";
import { EmptyState, MemberPreview } from "../components/EmptyState";
import { btn } from "../lib/ui";

function memberSince(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function PeerConnect() {
  const { user, loading, configured, profile } = useAuth();
  const isAdmin = Boolean(profile?.is_admin);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<DirectoryProfile[]>([]);
  const [searching, setSearching] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Debounced directory search — re-runs as the query changes. Admins also
  // see delisted members (dimmed, with a Restore button) so a removal can be
  // undone; everyone else only ever gets the visible ones.
  useEffect(() => {
    if (configured && !user) return;
    setSearching(true);
    const handle = setTimeout(() => {
      searchProfiles(query, user?.id, isAdmin)
        .then(setMembers)
        .catch(() => setMembers([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, user, configured, isAdmin]);

  /** Delist a member from the directory, or put them back. */
  const toggleVisibility = async (m: DirectoryProfile) => {
    const hide = !m.directory_hidden;
    const who = m.full_name || "this member";
    if (
      hide &&
      !window.confirm(
        `Remove ${who} from Peer Connect?\n\n` +
          "They stay a member — their account, rides and points are untouched — " +
          "they just stop appearing in the directory. You can restore them here."
      )
    ) {
      return;
    }
    setBusyId(m.id);
    try {
      await setMemberVisibility(m.id, hide);
      setMembers((list) =>
        // Keep the row in place so the admin can immediately undo.
        list.map((x) => (x.id === m.id ? { ...x, directory_hidden: hide } : x))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update the member");
    } finally {
      setBusyId(null);
    }
  };

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
          <EmptyState
            title={query.trim() ? "No matches" : "No members yet"}
            body={
              query.trim()
                ? `Nothing matches "${query.trim()}". Try a different name or membership ID.`
                : "You're early. As fellow CAs join, they'll be listed here to call or email."
            }
            preview={<MemberPreview />}
            actions={
              query.trim() ? (
                <button onClick={() => setQuery("")} className={btn("secondary")}>
                  Clear search
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {members.map((m) => (
              <article
                key={m.id}
                className={`group relative flex h-full flex-col rounded-2xl border bg-card p-5 transition-all duration-200 ${
                  m.directory_hidden
                    ? "border-dashed border-border opacity-60"
                    : "border-border/60 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
                }`}
              >
                {/* Points sit in the corner instead of interrupting the column. */}
                <span
                  title="Reward points"
                  className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                >
                  <Award className="w-3 h-3" />
                  {m.points}
                </span>

                {m.directory_hidden && (
                  <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    <EyeOff className="w-3 h-3" />
                    Removed from directory
                  </span>
                )}

                {/* Identity reads left-to-right like a directory entry, rather
                    than a centred stack. pr-12 keeps it clear of the chip. */}
                <div className="flex items-start gap-3.5 pr-12">
                  <Avatar
                    src={m.avatar_url}
                    name={m.full_name}
                    className="w-14 h-14 ring-2 ring-primary/10 ring-offset-2 ring-offset-card"
                  />
                  <div className="min-w-0 pt-0.5">
                    <h2
                      className="truncate font-semibold leading-snug"
                      title={m.full_name ?? undefined}
                    >
                      {m.full_name}
                    </h2>
                    {m.membership_id && (
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        ICAI {m.membership_id}
                      </p>
                    )}
                    {m.created_at && (
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        Joined {memberSince(m.created_at)}
                      </p>
                    )}
                  </div>
                </div>

                {m.bio && (
                  <p className="mt-3.5 line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">
                    {m.bio}
                  </p>
                )}

                {/* mt-auto pins the actions to the bottom, so the buttons line
                    up across the row however much content each card has. */}
                <div className="mt-auto pt-4">
                  <div className="flex items-center gap-2 border-t border-border/60 pt-3.5">
                    {m.phone || m.email ? (
                      <>
                        {m.phone && (
                          <a href={`tel:${m.phone}`} className={`${btn("secondary", "sm")} flex-1`}>
                            <Phone className="w-4 h-4" />
                            Call
                          </a>
                        )}
                        {m.email && (
                          <a
                            href={`mailto:${m.email}`}
                            className={`${btn("secondary", "sm")} flex-1`}
                          >
                            <Mail className="w-4 h-4" />
                            Email
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="py-1 text-xs text-muted-foreground">
                        No contact details shared
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="mt-2.5 flex justify-end">
                      <button
                        onClick={() => toggleVisibility(m)}
                        disabled={busyId === m.id}
                        className={btn(
                          m.directory_hidden ? "secondary" : "dangerGhost",
                          "sm"
                        )}
                      >
                        {busyId === m.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : m.directory_hidden ? (
                          <Undo2 className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                        {m.directory_hidden ? "Restore" : "Remove"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { Link, NavLink, useNavigate } from "react-router";
import { User, Menu, X, LogOut, Award } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
    isActive
      ? "bg-primary/10 text-primary"
      : "text-foreground/70 hover:text-foreground hover:bg-accent"
  }`;

export function Header() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { openLogin } = useAuthModal();
  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split("@")[0] ||
    "Profile";

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    navigate("/");
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-3 sm:px-5 pt-3 sm:pt-4">
      <div className="max-w-7xl mx-auto rounded-2xl border border-border/70 bg-card/75 backdrop-blur-xl shadow-lg shadow-black/5 ring-1 ring-black/5">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <img src="/logo.png" alt="CACommute" className="w-8 h-8 rounded-lg object-cover" />
              <span className="font-bold text-lg tracking-tight hidden sm:block">CACommute</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
              <NavLink to="/connect" className={navLinkClass}>
                Peer Connect
              </NavLink>
              <NavLink to="/events" className={navLinkClass}>
                Forthcoming Events
              </NavLink>
              {profile?.is_admin && (
                <NavLink to="/admin" className={navLinkClass}>
                  Admin
                </NavLink>
              )}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {user ? (
                <>
                  <span
                    title="Reward points"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm"
                  >
                    <Award className="w-4 h-4" />
                    {profile?.points ?? 0}
                  </span>
                  <button
                    onClick={() => navigate("/profile")}
                    className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-transparent hover:border-border hover:bg-accent transition-colors"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </span>
                    )}
                    <span className="max-w-[8rem] truncate text-sm font-medium">{displayName}</span>
                  </button>
                  <button
                    onClick={handleSignOut}
                    title="Log out"
                    className="flex items-center justify-center w-9 h-9 rounded-full text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={openLogin}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
                >
                  <User className="w-4 h-4" />
                  <span>Log in</span>
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 -mr-2 rounded-lg hover:bg-accent transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/70 py-3 space-y-1">
              <Link
                to="/connect"
                className="block px-4 py-2.5 text-foreground/80 hover:bg-accent rounded-xl transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Peer Connect
              </Link>
              <Link
                to="/events"
                className="block px-4 py-2.5 text-foreground/80 hover:bg-accent rounded-xl transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Forthcoming Events
              </Link>
              {profile?.is_admin && (
                <Link
                  to="/admin"
                  className="block px-4 py-2.5 text-primary font-medium hover:bg-accent rounded-xl transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
              <div className="border-t border-border/70 my-2" />
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="flex items-center justify-between px-4 py-2.5 text-foreground/80 hover:bg-accent rounded-xl transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>Profile</span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      <Award className="w-4 h-4" />
                      {profile?.points ?? 0}
                    </span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2.5 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openLogin();
                  }}
                  className="block w-full text-left px-4 py-2.5 text-foreground font-medium hover:bg-accent rounded-xl transition-colors"
                >
                  Log in
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

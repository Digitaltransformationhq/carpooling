import { Link } from "react-router";
import { Facebook, Twitter, Instagram } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Footer() {
  const { profile } = useAuth();
  const isAdmin = Boolean(profile?.is_admin);

  return (
    <footer className="bg-card border-t border-border text-foreground mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="CACommute" className="w-10 h-10 rounded-lg object-cover" />
              <span className="font-semibold text-xl">CACommute</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Connecting travelers, rewarding every shared seat, and making journeys more
              sustainable.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/search" className="text-muted-foreground hover:text-foreground text-sm">
                  Find a Ride
                </Link>
              </li>
              <li>
                <Link to="/publish" className="text-muted-foreground hover:text-foreground text-sm">
                  Publish a Ride
                </Link>
              </li>
              <li>
                <Link to="/profile" className="text-muted-foreground hover:text-foreground text-sm">
                  My Profile
                </Link>
              </li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="font-semibold mb-4">About</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground text-sm">
                  How it Works
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground text-sm">
                  Safety
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground text-sm">
                  Trust & Safety
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="font-semibold mb-4">Connect</h3>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm text-muted-foreground">
          <p>&copy; 2026 CACommute. All rights reserved.</p>
          <span className="hidden sm:inline">·</span>
          {/* Already an admin? Offer the panel, not another sign-in. */}
          <Link
            to={isAdmin ? "/admin" : "/admin/login"}
            className="hover:text-foreground transition-colors"
          >
            {isAdmin ? "Admin Panel" : "Admin Login"}
          </Link>
        </div>
      </div>

      {/* Oversized wordmark across the very bottom. Decorative only — the
          brand is already a link at the top of the footer — so it's hidden
          from screen readers and unselectable.

          Drawn as SVG rather than styled text because a clamp()ed font-size
          can only approximate the width: textLength forces the word to span
          exactly the box at every viewport, so it stays edge to edge with the
          same small gutter whether it's a phone or a widescreen. It sits
          outside the max-w-7xl container so it spans the full page. */}
      <div className="select-none px-4 sm:px-6" aria-hidden="true">
        <svg
          // The viewBox bottom IS the text baseline, and uppercase glyphs sit
          // on the baseline — so the letters end flush with the footer's
          // bottom edge, with no descender gap underneath.
          viewBox="0 0 1000 110"
          className="block h-auto w-full overflow-visible text-primary"
          role="presentation"
          focusable="false"
        >
          <defs>
            <linearGradient id="cacommute-wordmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          <text
            x="500"
            y="110"
            textAnchor="middle"
            textLength="1000"
            lengthAdjust="spacingAndGlyphs"
            fill="url(#cacommute-wordmark)"
            style={{ fontSize: 152, fontWeight: 900, fontFamily: "inherit" }}
          >
            CACOMMUTE
          </text>
        </svg>
      </div>
    </footer>
  );
}

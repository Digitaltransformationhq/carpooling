import { useState } from "react";
import { User } from "lucide-react";

interface AvatarProps {
  /** The member's uploaded photo, if they have one. */
  src?: string | null;
  /** Used for alt text / the aria label. */
  name?: string | null;
  /** Size (and any extra) classes for the circle, e.g. "w-12 h-12". */
  className?: string;
}

/**
 * Earlier builds fell back to a stock Unsplash portrait, which read as if it
 * were the member's real face — a stranger's photo above someone's name and
 * ICAI ID. Real uploads live in the Supabase `avatars` bucket, so anything
 * still pointing at Unsplash is that old placeholder and gets the silhouette
 * instead. This also covers rides published before the fix, whose
 * `driver_avatar` column still holds a stock URL.
 */
function isStockPhoto(url: string): boolean {
  return /(^|\.)unsplash\.com$/i.test(safeHost(url));
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * A member's profile photo, or a neutral silhouette when they haven't
 * uploaded one. Never substitutes a stock portrait for a missing photo.
 */
export function Avatar({ src, name, className = "w-12 h-12" }: AvatarProps) {
  // A saved URL can still 404 (deleted from storage, expired cache-buster) —
  // fall back to the silhouette rather than showing a broken image. Remember
  // *which* URL failed, not just that one did: React reuses this component
  // across re-renders, so a plain boolean would keep showing the silhouette
  // after src changed to a good photo (e.g. right after uploading a new one).
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const url = src?.trim();
  const usable = url && !isStockPhoto(url) && failedSrc !== url;

  if (!usable) {
    return (
      <span
        role="img"
        aria-label={name ? `${name} — no profile photo` : "No profile photo"}
        className={`${className} shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center overflow-hidden`}
      >
        {/* Half the circle's width, so one component covers every size we use. */}
        <User className="w-1/2 h-1/2" strokeWidth={1.75} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={name ?? ""}
      onError={() => setFailedSrc(url)}
      // Google account photos (lh3.googleusercontent.com) are served for a
      // signed-in Google session and answer 403 to a hotlink that carries our
      // Referer — which is how most OAuth users' photos go missing. Sending no
      // referrer makes them load; it's harmless for our own Storage URLs.
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={`${className} shrink-0 rounded-full object-cover bg-muted`}
    />
  );
}

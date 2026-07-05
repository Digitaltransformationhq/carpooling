# CACommute — Carpooling Web App

A responsive, installable carpooling website (BlaBlaCar-style) rebuilt from the
[Figma Make design](https://www.figma.com/make/3UCoUoHj5eE65Gz5n7D00x/Responsive-Car-Pooling-Website)
with a modern stack.

## Tech stack (latest)
- **React 19** + **TypeScript**
- **Vite 6** (lightning-fast dev/build)
- **React Router 7** (data router, `createBrowserRouter`)
- **Tailwind CSS v4** (via `@tailwindcss/vite`, no config file — CSS-first theme)
- **lucide-react** icons
- **Supabase** (Postgres) backend — rides, search, publish, bookings
- **MapLibre GL + OpenFreeMap** — free vector-tile map (no API key)
- **vite-plugin-pwa** — installable PWA with offline service worker

## Backend setup (Supabase)
The app reads/writes rides and bookings from Supabase. **Until you add keys it
runs on local seed data**, so it works out of the box — connect Supabase to make
publishing and booking persist.

1. Create a free project at [supabase.com](https://supabase.com).
2. In the dashboard: **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run** (creates the
   `rides` + `bookings` tables, open RLS policies, and seeds 6 rides).
   Then run [`supabase/profiles.sql`](supabase/profiles.sql) too — it adds a
   `public.profiles` table that auto-syncs from Supabase Auth (auth users live
   in the hidden `auth.users` table; this gives you a visible/queryable one).
3. **Project Settings → API**, copy the **Project URL** and **anon public** key.
4. Put them in `.env` (already gitignored):
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
5. Restart `npm run dev`. Search, ride details, **Publish a Ride**, and
   **Book Now** now hit the live database.

> The seed RLS policies are intentionally open (anon read/insert) so the demo
> works without login. Add Supabase Auth + per-user policies before production.

## Pages
| Route | Page |
|-------|------|
| `/` | Home — hero search, features, featured rides, how-it-works, CTA |
| `/search` | Search results — filters sidebar + ride list |
| `/ride/:id` | Ride details — route, driver, preferences, booking card |
| `/publish` | Publish a ride — full form |
| `/profile` | Profile — stats + tabs (rides / reviews / settings) |
| `*` | 404 Not Found |

Shared `Header` (responsive nav with mobile menu) and `Footer` wrap every page via the `Root` layout.

## Run locally
```powershell
npm install      # already done
npm run dev      # dev server at http://localhost:5173
npm run build    # production build -> dist/  (also generates sw.js + manifest)
npm run preview  # preview the production build
```

### Install on mobile (PWA)
1. Run `npm run dev -- --host` (or deploy `dist/`) and open the **Network** URL on your phone (same Wi-Fi).
2. Chrome/Edge → menu → **Install app / Add to Home screen**. iOS Safari → Share → **Add to Home Screen**.
3. The app launches standalone (no browser chrome) and works offline thanks to the precached service worker.

> Installability + offline require a secure context — `localhost` is exempt, otherwise serve `dist/` over **HTTPS** (GitHub Pages, Netlify, Vercel, etc.).

## Project structure
```
src/
  main.tsx                # React entry
  styles/                 # Tailwind v4 + theme tokens (oklch design system)
  app/
    App.tsx               # RouterProvider
    routes.tsx            # route table
    data/mockData.ts      # sample rides
    components/           # Header, Footer, SearchBar, RideCard
    pages/                # Root, Home, SearchResults, RideDetails, PublishRide, Profile, NotFound
public/                   # favicon.svg + PWA icons (192 / 512 / maskable / apple-touch)
```

## Notes
- The Figma Make export shipped a large unused `ui/` (shadcn) library and many heavy deps (MUI, recharts, etc.) that the actual pages never import — these were dropped, keeping the bundle lean (~102 kB gzipped JS).
- Fixed a latent bug in `RideCard` where it read `ride.rating` / `ride.reviewCount` (non-existent) instead of `ride.driver.rating` / `ride.driver.reviewCount`.

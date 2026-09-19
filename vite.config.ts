import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Google OAuth and password-reset links come back to window.location.origin,
  // which Supabase only honours for URLs on its redirect allowlist — and that
  // list pins the dev origin to http://localhost:3000. strictPort fails loudly
  // instead of silently moving to another port (which would send every auth
  // redirect to a port with nothing listening on it).
  server: { port: 3000, strictPort: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32x32.png", "favicon-16x16.png", "apple-touch-icon.png"],
      workbox: {
        // SPA fallback so deep links work offline
        navigateFallback: "/index.html",
        // ...but never for auth landing pages. A returning visitor has the
        // previous index.html precached, which points at the previous JS
        // bundle — and if that build predates a route, the emailed link lands
        // on the app's own 404. These must always hit the network so they get
        // the current build.
        navigateFallbackDenylist: [/^\/reset-password/, /^\/login/],
        // push + notification-click handlers for ride alerts (public/push-sw.js)
        importScripts: ["/push-sw.js"],
      },
      manifest: {
        name: "CACommute — Carpooling",
        short_name: "CACommute",
        description:
          "Your pick of rides at low prices. Search, book and publish carpool rides.",
        theme_color: "#030213",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["travel", "navigation", "lifestyle"],
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

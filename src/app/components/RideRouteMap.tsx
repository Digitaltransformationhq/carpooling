import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Polyline } from "../lib/geo";

/** Free vector-tile style from OpenFreeMap — no API key, no usage limits. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export interface MapStop {
  lng: number;
  lat: number;
  label?: string;
}

interface RideRouteMapProps {
  /** Driving route as [lng,lat] pairs (ride.route). */
  route?: Polyline;
  /** Rider pickup points to plot along the route. */
  pickups?: MapStop[];
}

/** Escape text before putting it into popup HTML. */
function esc(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function pin(color: string) {
  const el = document.createElement("div");
  el.style.cursor = "default";
  el.innerHTML = `
    <svg width="24" height="32" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z" fill="${color}"/>
      <circle cx="13" cy="13" r="5" fill="#ffffff"/>
    </svg>`;
  return el;
}

/**
 * Shows a single ride's driving route with start/end markers and any rider
 * pickup points. Private by design — only rendered on that ride's page.
 */
export default function RideRouteMap({ route, pickups = [] }: RideRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [78, 22],
      zoom: 4,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.scrollZoom.disable();

    map.on("load", () => {
      const bounds = new maplibregl.LngLatBounds();

      if (route && route.length > 1) {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: route },
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#eab308", "line-width": 4 },
        });
        route.forEach((c) => bounds.extend(c as [number, number]));

        // start (indigo) + end (magenta)
        new maplibregl.Marker({ element: pin("#4f46e5") })
          .setLngLat(route[0] as [number, number])
          .addTo(map);
        new maplibregl.Marker({ element: pin("#c026d3") })
          .setLngLat(route[route.length - 1] as [number, number])
          .addTo(map);
      }

      // rider pickup points (brand yellow)
      pickups.forEach((p) => {
        const marker = new maplibregl.Marker({ element: pin("#f59e0b") }).setLngLat([p.lng, p.lat]);
        if (p.label) {
          marker.setPopup(
            new maplibregl.Popup({ offset: 26, closeButton: false }).setHTML(
              `<div style="font:500 12px system-ui">${esc(p.label)}</div>`
            )
          );
        }
        marker.addTo(map);
        bounds.extend([p.lng, p.lat]);
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
      }
    });

    return () => map.remove();
    // Re-init only when the route or pickup set actually changes.
  }, [JSON.stringify(route), JSON.stringify(pickups)]);

  return (
    <div
      ref={containerRef}
      className="h-[320px] w-full rounded-xl overflow-hidden border border-border"
    />
  );
}

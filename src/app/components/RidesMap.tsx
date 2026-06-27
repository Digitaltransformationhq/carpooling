import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router";
import { mockRides } from "../data/mockData";

/** Free vector-tile style from OpenFreeMap — no API key, no usage limits. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** [lng, lat] for the cities used in the mock rides (MapLibre uses lng,lat order). */
const CITY_COORDS: Record<string, [number, number]> = {
  "New Delhi, DL": [77.209, 28.6139],
  "Jaipur, RJ": [75.7873, 26.9124],
  "Mumbai, MH": [72.8777, 19.076],
  "Pune, MH": [73.8567, 18.5204],
  "Bengaluru, KA": [77.5946, 12.9716],
  "Mysuru, KA": [76.6394, 12.2958],
  "Hyderabad, TS": [78.4867, 17.385],
  "Ahmedabad, GJ": [72.5714, 23.0225],
  "Surat, GJ": [72.8311, 21.1702],
  "Chennai, TN": [80.2707, 13.0827],
};

const START_COLOR = "#4f46e5";
const END_COLOR = "#c026d3";

/** Escape text before putting it into popup HTML (defends against stored XSS). */
function esc(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function pinElement(color: string) {
  const el = document.createElement("div");
  el.style.cursor = "pointer";
  el.innerHTML = `
    <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z" fill="${color}"/>
      <circle cx="13" cy="13" r="5" fill="#ffffff"/>
    </svg>`;
  return el;
}

export default function RidesMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [79, 22], // India
      zoom: 4,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.scrollZoom.disable();

    // Draw dashed route lines once the style is ready.
    map.on("load", () => {
      const features = mockRides
        .filter((r) => CITY_COORDS[r.from] && CITY_COORDS[r.to])
        .map((r) => ({
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "LineString" as const,
            coordinates: [CITY_COORDS[r.from], CITY_COORDS[r.to]],
          },
        }));

      map.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": START_COLOR,
          "line-width": 2.5,
          "line-opacity": 0.6,
          "line-dasharray": [2, 2],
        },
      });
    });

    // Markers (one per unique city) with popups.
    const starts = new Set(mockRides.map((r) => r.from));
    const ends = new Set(mockRides.map((r) => r.to));
    const cities = Array.from(new Set([...starts, ...ends])).filter((c) => CITY_COORDS[c]);

    cities.forEach((city) => {
      const ridesFromHere = mockRides.filter((r) => r.from === city);
      const isStart = starts.has(city);
      const links = ridesFromHere
        .map(
          (r) =>
            `<a href="/ride/${encodeURIComponent(r.id)}" data-ride="${esc(r.id)}" style="display:block;color:#4f46e5;font-size:13px;text-decoration:none;margin-top:2px">→ ${esc(r.to)}</a>`
        )
        .join("");
      const html = `
        <div style="font-family:inherit">
          <p style="font-weight:600;margin:0 0 2px">${esc(city)}</p>
          ${links || '<p style="font-size:12px;color:#6b7280;margin:0">Drop-off point</p>'}
        </div>`;

      const popup = new maplibregl.Popup({ offset: 26, closeButton: false }).setHTML(html);
      new maplibregl.Marker({ element: pinElement(isStart ? START_COLOR : END_COLOR) })
        .setLngLat(CITY_COORDS[city])
        .setPopup(popup)
        .addTo(map);
    });

    // SPA navigation from popup links instead of full page reload.
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("[data-ride]") as HTMLElement | null;
      if (target) {
        e.preventDefault();
        navigate(`/ride/${target.dataset.ride}`);
      }
    };
    containerRef.current.addEventListener("click", onClick);
    const container = containerRef.current;

    return () => {
      container.removeEventListener("click", onClick);
      map.remove();
    };
  }, [navigate]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full rounded-xl overflow-hidden border"
    />
  );
}

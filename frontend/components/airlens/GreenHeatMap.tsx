"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { GridCell, CoolRoute, HEAT_RISK_LABELS } from "@/lib/airlens";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const CELLS_SOURCE  = "airlens-cells";
const HEAT_LAYER    = "airlens-heat";
const CIRCLE_LAYER  = "airlens-circles";
const LABEL_LAYER   = "airlens-labels";
const ROUTE_SOURCE  = "airlens-route";
const ROUTE_LAYER   = "airlens-route-line";
const ROUTE_DOTS    = "airlens-route-dots";
const ROUTE_LABELS  = "airlens-route-labels";

// Mapbox color interpolation expression: green score → colour
const COLOR_EXPR: mapboxgl.Expression = [
  "interpolate", ["linear"], ["get", "greenScore"],
  0,  "#d73027",
  10, "#f46d43",
  20, "#fee08b",
  30, "#91cf60",
  40, "#1a9850",
];

interface GreenHeatMapProps {
  cells: GridCell[];
  coolRoute?: CoolRoute | null;
  center: { lat: number; lng: number };
  zoom?: number;
}

export default function GreenHeatMap({
  cells,
  coolRoute,
  center,
  zoom = 14,
}: GreenHeatMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [center.lng, center.lat],
      zoom,
      antialias: true,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draw cells ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = () => {
      // Clean up previous layers/source
      [LABEL_LAYER, CIRCLE_LAYER, HEAT_LAYER].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(CELLS_SOURCE)) map.removeSource(CELLS_SOURCE);

      if (!cells?.length) return;

      const features: GeoJSON.Feature<GeoJSON.Point>[] = cells.map((cell) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [cell.lng, cell.lat] },
        properties: {
          greenScore:    cell.green_score,
          heatRisk:      cell.heat_risk,
          heatRiskLabel: HEAT_RISK_LABELS[cell.heat_risk],
          vegetationPct: cell.vegetation_pct,
          buildingPct:   cell.building_pct,
          roadPct:       cell.road_pct,
          sidewalkPct:   cell.sidewalk_pct,
          concreteRatio: cell.concrete_ratio,
          fromCache:     cell.from_cache,
          label:         `${Math.round(cell.green_score)}%`,
        },
      }));

      map.addSource(CELLS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      // ── 1. Smooth heatmap backdrop ──────────────────────────────────────
      map.addLayer({
        id: HEAT_LAYER,
        type: "heatmap",
        source: CELLS_SOURCE,
        paint: {
          // Weight: high green score = stronger signal
          "heatmap-weight": [
            "interpolate", ["linear"], ["get", "greenScore"],
            0, 0.3, 100, 1,
          ],
          // Heatmap intensity by zoom
          "heatmap-intensity": [
            "interpolate", ["linear"], ["zoom"],
            11, 0.6, 15, 1.5,
          ],
          // Colour ramp: red (no green) → green (lots of green)
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0,   "rgba(215,48,39,0)",
            0.2, "rgba(215,48,39,0.55)",
            0.4, "rgba(244,109,67,0.65)",
            0.6, "rgba(254,224,139,0.70)",
            0.8, "rgba(145,207,96,0.75)",
            1,   "rgba(26,152,80,0.85)",
          ],
          // Radius in pixels — roughly matches 200 m grid spacing
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            11, 20, 14, 50, 16, 90,
          ],
          "heatmap-opacity": 0.75,
        },
      });

      // ── 2. Crisp circle per point ───────────────────────────────────────
      // Outer glow
      map.addLayer({
        id: `${CIRCLE_LAYER}-glow`,
        type: "circle",
        source: CELLS_SOURCE,
        minzoom: 13,
        paint: {
          "circle-radius": 22,
          "circle-color": COLOR_EXPR,
          "circle-opacity": 0.18,
          "circle-blur": 0.8,
        },
      });

      map.addLayer({
        id: CIRCLE_LAYER,
        type: "circle",
        source: CELLS_SOURCE,
        minzoom: 13,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            13, 10, 15, 16, 17, 24,
          ],
          "circle-color": COLOR_EXPR,
          "circle-opacity": 0.9,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "rgba(255,255,255,0.35)",
        },
      });

      // ── 3. Score label ──────────────────────────────────────────────────
      map.addLayer({
        id: LABEL_LAYER,
        type: "symbol",
        source: CELLS_SOURCE,
        minzoom: 13.5,
        layout: {
          "text-field": ["get", "label"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13.5, 9, 16, 13],
          "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.6)",
          "text-halo-width": 1.5,
        },
      });

      // ── Click popup ─────────────────────────────────────────────────────
      map.on("click", CIRCLE_LAYER, (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as {
          greenScore:    number;
          heatRisk:      string;
          heatRiskLabel: string;
          vegetationPct: number;
          buildingPct:   number;
          roadPct:       number;
          sidewalkPct:   number;
          concreteRatio: number;
          fromCache:     boolean;
        };
        const [lng, lat] = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

        const riskColors: Record<string, string> = {
          LOW: "#1a9850", MODERATE: "#d4a017", HIGH: "#f46d43", CRITICAL: "#d73027",
        };
        const riskColor = riskColors[p.heatRisk] ?? "#888";

        // Safely handle values that may come from GeoJSON as numbers
        const veg  = Number(p.vegetationPct).toFixed(1);
        const bld  = Number(p.buildingPct).toFixed(1);
        const road = Number(p.roadPct).toFixed(1);
        const side = Number(p.sidewalkPct).toFixed(1);
        const con  = Number(p.concreteRatio).toFixed(1);
        const gs   = Number(p.greenScore).toFixed(0);

        new mapboxgl.Popup({ closeButton: true, maxWidth: "260px" })
          .setLngLat([lng, lat])
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;background:#1a1a2e;border-radius:12px;padding:14px;color:#f0f0f0;min-width:220px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                <div style="width:48px;height:48px;border-radius:10px;background:${riskColor};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;flex-shrink:0">
                  ${gs}%
                </div>
                <div>
                  <div style="font-weight:700;font-size:14px;color:#fff">Yeşillik Skoru</div>
                  <div style="display:inline-block;margin-top:3px;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${riskColor}22;color:${riskColor};border:1px solid ${riskColor}44">
                    ${p.heatRiskLabel}
                  </div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:auto 1fr auto;gap:5px 8px;font-size:12px;align-items:center">
                <span>🌳</span><span style="color:#aaa">Bitki</span><span style="color:#fff;text-align:right;font-weight:600">${veg}%</span>
                <span>🏢</span><span style="color:#aaa">Bina</span><span style="color:#fff;text-align:right;font-weight:600">${bld}%</span>
                <span>🛣</span><span style="color:#aaa">Yol</span><span style="color:#fff;text-align:right;font-weight:600">${road}%</span>
                <span>🚶</span><span style="color:#aaa">Kaldırım</span><span style="color:#fff;text-align:right;font-weight:600">${side}%</span>
                <span>⬛</span><span style="color:#aaa">Toplam Beton</span><span style="color:#fff;text-align:right;font-weight:600">${con}%</span>
              </div>
              <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;font-size:11px;color:#666">
                <span>${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
                <span style="color:${p.fromCache ? '#facc15' : '#4ade80'}">${p.fromCache ? "⚡ önbellek" : "🔴 canlı"}</span>
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseenter", CIRCLE_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", CIRCLE_LAYER, () => { map.getCanvas().style.cursor = ""; });

      // Fit to data
      if (cells.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        cells.forEach((c) => bounds.extend([c.lng, c.lat]));
        map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 900 });
      }
    };

    if (map.loaded()) draw();
    else map.once("load", draw);
  }, [cells]);

  // ── Draw cool route ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const drawRoute = () => {
      [ROUTE_LABELS, ROUTE_DOTS, ROUTE_LAYER].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);

      if (!coolRoute?.waypoints?.length) return;

      const sorted = [...coolRoute.waypoints].sort((a, b) => a.order - b.order);
      const lineCoords = sorted.map((wp) => [wp.lng, wp.lat] as [number, number]);

      const dotFeatures: GeoJSON.Feature<GeoJSON.Point>[] = sorted.map((wp) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [wp.lng, wp.lat] },
        properties: { order: wp.order, greenScore: wp.green_score, label: `${wp.order}` },
      }));

      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            { type: "Feature", geometry: { type: "LineString", coordinates: lineCoords }, properties: {} },
            ...dotFeatures,
          ],
        },
      });

      // Glow line
      map.addLayer({
        id: `${ROUTE_LAYER}-glow`,
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", "$type", "LineString"],
        paint: { "line-color": "#4ade80", "line-width": 10, "line-opacity": 0.25, "line-blur": 4 },
      });
      map.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", "$type", "LineString"],
        paint: { "line-color": "#4ade80", "line-width": 3, "line-dasharray": [5, 2.5], "line-opacity": 0.95 },
      });

      // Numbered waypoint dots
      map.addLayer({
        id: ROUTE_DOTS,
        type: "circle",
        source: ROUTE_SOURCE,
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": 10,
          "circle-color": "#4ade80",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: ROUTE_LABELS,
        type: "symbol",
        source: ROUTE_SOURCE,
        filter: ["==", "$type", "Point"],
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#000", "text-halo-color": "#4ade80", "text-halo-width": 1 },
      });
    };

    if (map.loaded()) drawRoute();
    else map.once("load", drawRoute);
  }, [coolRoute]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}

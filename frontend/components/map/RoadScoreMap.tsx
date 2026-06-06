"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  ScoreRoute,
  SegmentScore,
  AreaScanPoint,
  categoryColor,
  polylineToGeoJSON,
} from "@/lib/roadscore";
import { circlePolygonCoords, getNeighborhoodBounds } from "@/data/neighborhoods";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface Marker {
  lat: number;
  lng: number;
  label: "A" | "B";
}

export interface NeighborhoodInfo {
  lat: number;
  lng: number;
  radius: number; // meters
  name: string;
}

interface RoadScoreMapProps {
  routes: ScoreRoute[];
  activeRouteId: string | null;
  onSegmentClick: (segment: SegmentScore, route: ScoreRoute) => void;
  markers?: Marker[];
  onMapClick?: (lat: number, lng: number) => void;
  clickMode?: "origin" | "destination" | null;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  neighborhood?: NeighborhoodInfo;
  onOutOfBoundsClick?: () => void;
  showAllRoads?: boolean;
  // Area scan results — displayed as a damage heatmap on the map
  scanPoints?: AreaScanPoint[];
}

// ─── Layer / source IDs ───────────────────────────────────────────────────────
const ROUTE_LAYER_PREFIX   = "route-layer-";
const SEGMENT_LAYER_PREFIX = "segment-layer-";
const MASK_SOURCE          = "nb-mask-source";
const MASK_LAYER           = "nb-mask-layer";
const BORDER_SOURCE        = "nb-border-source";
const BORDER_GLOW_LAYER    = "nb-border-glow";
const BORDER_LAYER         = "nb-border-layer";
const ROADS_LAYER          = "nb-all-roads";
const SCAN_SOURCE          = "nb-scan-source";
const SCAN_LAYER           = "nb-scan-layer";
const SCAN_LABEL_LAYER     = "nb-scan-label";

// ─── Road class colour scheme ─────────────────────────────────────────────────
const ROAD_COLORS: mapboxgl.Expression = [
  "match", ["get", "class"],
  "motorway",    "#ef4444",
  "trunk",       "#f97316",
  "primary",     "#eab308",
  "secondary",   "#4ade80",
  "tertiary",    "#34d399",
  "street",      "#60a5fa",
  "#94a3b8", // fallback
];

const ROAD_WIDTHS: mapboxgl.Expression = [
  "match", ["get", "class"],
  "motorway", 4,
  "trunk",    3.5,
  "primary",  3,
  "secondary", 2.5,
  "tertiary",  2,
  1.5,
];

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function buildCircleMask(lat: number, lng: number, radius: number): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      // World (CCW) + circle hole (CW — circlePolygonCoords produces CW)
      coordinates: [
        [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
        circlePolygonCoords(lat, lng, radius),
      ],
    },
    properties: {},
  };
}

function buildCircleBorder(lat: number, lng: number, radius: number): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [circlePolygonCoords(lat, lng, radius)],
    },
    properties: {},
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoadScoreMap({
  routes,
  activeRouteId,
  onSegmentClick,
  markers = [],
  onMapClick,
  clickMode,
  initialCenter,
  initialZoom = 14,
  neighborhood,
  onOutOfBoundsClick,
  showAllRoads = false,
  scanPoints,
}: RoadScoreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const popupRef     = useRef<mapboxgl.Popup | null>(null);
  const markerRefsRef = useRef<mapboxgl.Marker[]>([]);
  // Stable ref so click handler always reads latest neighborhood
  const neighborhoodRef = useRef(neighborhood);
  neighborhoodRef.current = neighborhood;

  // ── Initialise map once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = initialCenter
      ? [initialCenter.lng, initialCenter.lat]
      : [28.9784, 41.0082];

    const mapOpts: mapboxgl.MapboxOptions = {
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom: initialCenter ? initialZoom : 11,
    };

    // Restrict camera to a padded area around the neighborhood
    if (neighborhood) {
      const nb = { lat: neighborhood.lat, lng: neighborhood.lng, radius: neighborhood.radius, id: "", name: "", district: "" };
      const b = getNeighborhoodBounds(nb, 2.0);
      mapOpts.maxBounds = [
        [b.west, b.south],
        [b.east, b.north],
      ];
    }

    const map = new mapboxgl.Map(mapOpts);
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    // Draw circle overlay after style loads
    if (neighborhood) {
      const { lat, lng, radius } = neighborhood;
      map.once("load", () => {
        // Dark mask outside the circle
        map.addSource(MASK_SOURCE, {
          type: "geojson",
          data: buildCircleMask(lat, lng, radius),
        });
        map.addLayer({
          id: MASK_LAYER,
          type: "fill",
          source: MASK_SOURCE,
          paint: { "fill-color": "#000000", "fill-opacity": 0.58 },
        });

        // Glowing halo border
        map.addSource(BORDER_SOURCE, {
          type: "geojson",
          data: buildCircleBorder(lat, lng, radius),
        });
        map.addLayer({
          id: BORDER_GLOW_LAYER,
          type: "line",
          source: BORDER_SOURCE,
          paint: {
            "line-color": "#3b82f6",
            "line-width": 10,
            "line-opacity": 0.20,
            "line-blur": 6,
          },
        });
        map.addLayer({
          id: BORDER_LAYER,
          type: "line",
          source: BORDER_SOURCE,
          paint: {
            "line-color": "#93c5fd",
            "line-width": 2,
            "line-opacity": 0.90,
            "line-dasharray": [5, 3],
          },
        });
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Show / hide all-roads layer ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !neighborhood) return;

    const tryApply = () => {
      const { lat, lng, radius } = neighborhood;
      const circleGeoJSON: GeoJSON.Geometry = {
        type: "Polygon",
        coordinates: [circlePolygonCoords(lat, lng, radius)],
      };

      if (showAllRoads) {
        if (!map.getLayer(ROADS_LAYER)) {
          map.addLayer(
            {
              id: ROADS_LAYER,
              type: "line",
              source: "composite",
              "source-layer": "road",
              filter: ["within", circleGeoJSON],
              paint: {
                "line-color": ROAD_COLORS,
                "line-width": ROAD_WIDTHS,
                "line-opacity": 0.85,
              },
            },
            // Insert below mask so roads appear inside the lit circle
            MASK_LAYER,
          );
        }
      } else {
        if (map.getLayer(ROADS_LAYER)) map.removeLayer(ROADS_LAYER);
      }
    };

    if (map.loaded()) {
      tryApply();
    } else {
      map.once("load", tryApply);
    }
  }, [showAllRoads, neighborhood]);

  // ── Map click → bounds check → callback ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;

    const handler = (e: mapboxgl.MapMouseEvent) => {
      if (!clickMode) return;
      const { lat, lng } = e.lngLat;
      const nb = neighborhoodRef.current;

      if (nb) {
        const R = 6371000;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(lat - nb.lat);
        const dLng = toRad(lng - nb.lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(nb.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (dist > nb.radius) {
          onOutOfBoundsClick?.();
          return;
        }
      }

      onMapClick(lat, lng);
    };

    map.on("click", handler);
    map.getCanvas().style.cursor = clickMode ? "crosshair" : "";
    return () => { map.off("click", handler); };
  }, [onMapClick, clickMode, onOutOfBoundsClick]);

  // ── A / B pin markers ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRefsRef.current.forEach((m) => m.remove());
    markerRefsRef.current = [];
    markers.forEach(({ lat, lng, label }) => {
      const el = document.createElement("div");
      el.style.cssText = `width:28px;height:28px;border-radius:50%;background:${
        label === "A" ? "#22c55e" : "#ef4444"
      };border:2px solid white;display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.5)`;
      el.textContent = label;
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRefsRef.current.push(marker);
    });
  }, [markers]);

  // ── Draw route layers ─────────────────────────────────────────────────────
  const drawRoutes = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    routes.forEach((_, i) => {
      const ids = [
        `${ROUTE_LAYER_PREFIX}${i}`,
        `${SEGMENT_LAYER_PREFIX}${i}`,
        `route-source-${i}`,
        `segment-source-${i}`,
      ];
      ids.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      });
    });

    const bounds = new mapboxgl.LngLatBounds();

    routes.forEach((route, i) => {
      const isActive = route.id === activeRouteId;
      const sourceId    = `route-source-${i}`;
      const layerId     = `${ROUTE_LAYER_PREFIX}${i}`;
      const segSourceId = `segment-source-${i}`;
      const segLayerId  = `${SEGMENT_LAYER_PREFIX}${i}`;

      const lineCoords = polylineToGeoJSON(route.encoded_polyline);
      lineCoords.forEach(([lng, lat]) => bounds.extend([lng, lat]));

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: lineCoords },
          properties: {},
        },
      });
      map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": isActive ? "#ffffff" : "#6b7280",
          "line-width": isActive ? 5 : 3,
          "line-opacity": isActive ? 1 : 0.4,
        },
      });

      if (route.segments && route.segments.length > 0) {
        const features = route.segments.map((seg) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [seg.lng, seg.lat] },
          properties: {
            segmentId: seg.id,
            routeId: route.id,
            routeIdx: i,
            damageScore: seg.damage_score,
            damageCategory: seg.damage_category,
            confidence: seg.confidence,
            color: categoryColor[seg.damage_category].hex,
          },
        }));

        map.addSource(segSourceId, {
          type: "geojson",
          data: { type: "FeatureCollection", features },
        });
        map.addLayer({
          id: segLayerId,
          type: "circle",
          source: segSourceId,
          paint: {
            "circle-radius": isActive ? 8 : 5,
            "circle-color": ["get", "color"],
            "circle-opacity": isActive ? 0.95 : 0.4,
            "circle-stroke-width": isActive ? 2 : 0,
            "circle-stroke-color": "#fff",
          },
        });

        map.on("click", segLayerId, (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties as { segmentId: string };
          const segment = route.segments.find((s) => s.id === props.segmentId);
          if (segment) onSegmentClick(segment, route);
        });
        map.on("mouseenter", segLayerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", segLayerId, () => { map.getCanvas().style.cursor = ""; });
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });
    }
  }, [routes, activeRouteId, onSegmentClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.loaded()) drawRoutes();
    else map.once("load", drawRoutes);
  }, [drawRoutes]);

  // ── Scan points heatmap ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      // Remove old layers/source
      if (map.getLayer(SCAN_LABEL_LAYER)) map.removeLayer(SCAN_LABEL_LAYER);
      if (map.getLayer(SCAN_LAYER)) map.removeLayer(SCAN_LAYER);
      if (map.getSource(SCAN_SOURCE)) map.removeSource(SCAN_SOURCE);

      if (!scanPoints || scanPoints.length === 0) return;

      const features = scanPoints.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: {
          damageScore: p.damage_score,
          damageCategory: p.damage_category,
          confidence: p.confidence,
          fromCache: p.from_cache,
          color: categoryColor[p.damage_category].hex,
          label: `${p.damage_score.toFixed(0)}`,
        },
      }));

      map.addSource(SCAN_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      // Outer glow
      map.addLayer({
        id: `${SCAN_LAYER}-glow`,
        type: "circle",
        source: SCAN_SOURCE,
        paint: {
          "circle-radius": 18,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.15,
          "circle-blur": 1,
        },
      });

      // Main dot
      map.addLayer({
        id: SCAN_LAYER,
        type: "circle",
        source: SCAN_SOURCE,
        paint: {
          "circle-radius": 10,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.88,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.6,
        },
      });

      // Score label
      map.addLayer({
        id: SCAN_LABEL_LAYER,
        type: "symbol",
        source: SCAN_SOURCE,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 9,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.4)",
          "text-halo-width": 1,
        },
      });

      // Click → popup with detail
      map.on("click", SCAN_LAYER, (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as {
          damageScore: number;
          damageCategory: string;
          confidence: number;
          fromCache: boolean;
          color: string;
        };
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

        const categoryLabels: Record<string, string> = {
          GOOD: "İyi",
          FAIR: "Orta",
          POOR: "Kötü",
          CRITICAL: "Kritik",
        };
        const label = categoryLabels[props.damageCategory] ?? props.damageCategory;

        new mapboxgl.Popup({ closeButton: true, maxWidth: "220px", className: "scan-popup" })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:sans-serif;padding:4px 0">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <div style="width:36px;height:36px;border-radius:50%;background:${props.color};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;flex-shrink:0">
                  ${props.damageScore.toFixed(0)}
                </div>
                <div>
                  <div style="font-weight:700;color:#fff;font-size:13px">${label}</div>
                  <div style="color:rgba(255,255,255,0.45);font-size:11px">Hasar Skoru</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">
                <div style="color:rgba(255,255,255,0.4)">Güven</div>
                <div style="color:#fff;text-align:right">${(props.confidence * 100).toFixed(0)}%</div>
                <div style="color:rgba(255,255,255,0.4)">Koordinat</div>
                <div style="color:#fff;text-align:right;font-size:10px">${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}</div>
                <div style="color:rgba(255,255,255,0.4)">Kaynak</div>
                <div style="color:#fff;text-align:right">${props.fromCache ? "Önbellekten" : "Canlı analiz"}</div>
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseenter", SCAN_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", SCAN_LAYER, () => { map.getCanvas().style.cursor = ""; });
    };

    if (map.loaded()) apply();
    else map.once("load", apply);
  }, [scanPoints]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => { popupRef.current?.remove(); }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}

"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  ScoreRoute,
  SegmentScore,
  categoryColor,
  polylineToGeoJSON,
} from "@/lib/roadscore";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface Marker {
  lat: number;
  lng: number;
  label: "A" | "B";
}

interface RoadScoreMapProps {
  routes: ScoreRoute[];
  activeRouteId: string | null;
  onSegmentClick: (segment: SegmentScore, route: ScoreRoute) => void;
  markers?: Marker[];
  onMapClick?: (lat: number, lng: number) => void;
  clickMode?: "origin" | "destination" | null;
  // Initial map center — used to focus on the selected neighborhood
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
}

const ROUTE_LAYER_PREFIX = "route-layer-";
const SEGMENT_LAYER_PREFIX = "segment-layer-";

export default function RoadScoreMap({
  routes,
  activeRouteId,
  onSegmentClick,
  markers = [],
  onMapClick,
  clickMode,
  initialCenter,
  initialZoom = 14,
}: RoadScoreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const markerRefsRef = useRef<mapboxgl.Marker[]>([]);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = initialCenter
      ? [initialCenter.lng, initialCenter.lat]
      : [28.9784, 41.0082]; // Istanbul default

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom: initialCenter ? initialZoom : 11,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Map click → set origin/destination
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;
    const handler = (e: mapboxgl.MapMouseEvent) => {
      if (clickMode) onMapClick(e.lngLat.lat, e.lngLat.lng);
    };
    map.on("click", handler);
    map.getCanvas().style.cursor = clickMode ? "crosshair" : "";
    return () => { map.off("click", handler); };
  }, [onMapClick, clickMode]);

  // A / B pin markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRefsRef.current.forEach((m) => m.remove());
    markerRefsRef.current = [];
    markers.forEach(({ lat, lng, label }) => {
      const el = document.createElement("div");
      el.style.cssText = `width:28px;height:28px;border-radius:50%;background:${label === "A" ? "#22c55e" : "#ef4444"};border:2px solid white;display:flex;align-items:center;justify-content:center;font-weight:bold;color:white;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.5)`;
      el.textContent = label;
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRefsRef.current.push(marker);
    });
  }, [markers]);

  // Draw/update route layers whenever routes change
  const drawRoutes = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    // Remove existing route layers + sources
    routes.forEach((_, i) => {
      const layerId = `${ROUTE_LAYER_PREFIX}${i}`;
      const segLayerId = `${SEGMENT_LAYER_PREFIX}${i}`;
      const sourceId = `route-source-${i}`;
      const segSourceId = `segment-source-${i}`;

      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getLayer(segLayerId)) map.removeLayer(segLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      if (map.getSource(segSourceId)) map.removeSource(segSourceId);
    });

    const bounds = new mapboxgl.LngLatBounds();

    routes.forEach((route, i) => {
      const isActive = route.id === activeRouteId;
      const sourceId = `route-source-${i}`;
      const layerId = `${ROUTE_LAYER_PREFIX}${i}`;
      const segSourceId = `segment-source-${i}`;
      const segLayerId = `${SEGMENT_LAYER_PREFIX}${i}`;

      // ── Full polyline line layer ─────────────────────────────────────────
      const lineCoords = polylineToGeoJSON(route.encoded_polyline);
      lineCoords.forEach(([lng, lat]) => bounds.extend([lng, lat]));

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: lineCoords },
          properties: { routeId: route.id, routeType: route.route_type },
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

      // ── Segment circles (colour by damage category) ──────────────────────
      if (route.segments && route.segments.length > 0) {
        const features = route.segments.map((seg) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [seg.lng, seg.lat],
          },
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

        // Click handler for segment detail panel
        map.on("click", segLayerId, (e) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties as {
            segmentId: string;
            routeIdx: number;
          };
          const segment = route.segments.find((s) => s.id === props.segmentId);
          if (segment) onSegmentClick(segment, route);
        });

        map.on("mouseenter", segLayerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", segLayerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    });

    // Fit map to all routes
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });
    }
  }, [routes, activeRouteId, onSegmentClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.loaded()) {
      drawRoutes();
    } else {
      map.once("load", drawRoutes);
    }
  }, [drawRoutes]);

  // Cleanup popup on unmount
  useEffect(() => {
    return () => {
      popupRef.current?.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}

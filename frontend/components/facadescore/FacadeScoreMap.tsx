'use client';

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { BuildingAnalysis } from '@/types/facadescore';
import { RISK_COLORS, RISK_LABELS_TR } from '@/types/facadescore';
import { circlePolygonCoords } from '@/data/neighborhoods';

export interface NeighborhoodInfo {
  lat: number;
  lng: number;
  radius: number;
  name: string;
}

const MASK_SOURCE   = 'fs-nb-mask-source';
const MASK_LAYER    = 'fs-nb-mask-layer';
const BORDER_SOURCE = 'fs-nb-border-source';
const BORDER_GLOW   = 'fs-nb-border-glow';
const BORDER_LAYER  = 'fs-nb-border-layer';

function buildCircleMask(lat: number, lng: number, radius: number): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
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
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [circlePolygonCoords(lat, lng, radius)],
    },
    properties: {},
  };
}

interface FacadeScoreMapProps {
  buildings: BuildingAnalysis[];
  selectedBuildingId: string | null;
  onBuildingSelect: (building: BuildingAnalysis) => void;
  center?: [number, number];
  neighborhood?: NeighborhoodInfo;
}

export default function FacadeScoreMap({
  buildings,
  selectedBuildingId,
  onBuildingSelect,
  center = [28.9784, 41.0082],
  neighborhood,
}: FacadeScoreMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  const clearMarkers = useCallback(() => {
    markers.current.forEach(m => m.remove());
    markers.current = [];
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: 14,
      trackResize: true,
      transformRequest: (url, resourceType) => {
        if (resourceType === 'Unknown' && url.includes('events.mapbox.com')) {
          return { url: '' };
        }
        return { url };
      },
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    if (neighborhood) {
      const { lat, lng, radius } = neighborhood;
      map.current.once('load', () => {
        const m = map.current;
        if (!m) return;

        m.addSource(MASK_SOURCE, {
          type: 'geojson',
          data: buildCircleMask(lat, lng, radius),
        });
        m.addLayer({
          id: MASK_LAYER,
          type: 'fill',
          source: MASK_SOURCE,
          paint: { 'fill-color': '#000000', 'fill-opacity': 0.58 },
        });

        m.addSource(BORDER_SOURCE, {
          type: 'geojson',
          data: buildCircleBorder(lat, lng, radius),
        });
        m.addLayer({
          id: BORDER_GLOW,
          type: 'line',
          source: BORDER_SOURCE,
          paint: {
            'line-color': '#3b82f6',
            'line-width': 10,
            'line-opacity': 0.20,
            'line-blur': 6,
          },
        });
        m.addLayer({
          id: BORDER_LAYER,
          type: 'line',
          source: BORDER_SOURCE,
          paint: {
            'line-color': '#93c5fd',
            'line-width': 2,
            'line-opacity': 0.90,
            'line-dasharray': [5, 3],
          },
        });
      });
    }

    return () => {
      clearMarkers();
      map.current?.remove();
      map.current = null;
    };
  }, [center, neighborhood, clearMarkers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map.current) return;
    clearMarkers();

    buildings.forEach(building => {
      const color = RISK_COLORS[building.risk_level];
      const isSelected = building.id === selectedBuildingId;

      const el = document.createElement('div');
      el.className = 'facade-marker';
      el.style.cssText = `
        width: ${isSelected ? 20 : 14}px;
        height: ${isSelected ? 20 : 14}px;
        border-radius: 50%;
        background-color: ${color};
        border: ${isSelected ? '3px solid white' : '2px solid rgba(255,255,255,0.6)'};
        cursor: pointer;
        box-shadow: 0 0 ${isSelected ? 12 : 6}px ${color};
        transition: all 0.2s ease;
      `;

      const popup = new mapboxgl.Popup({
        offset: 20,
        closeButton: false,
        className: 'facade-popup',
      }).setHTML(`
        <div style="padding:8px;min-width:160px;font-family:sans-serif">
          <div style="font-weight:600;font-size:12px;color:#1e293b">${building.district}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">${building.address || 'Adres bilinmiyor'}</div>
          <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
            <span style="font-size:12px;font-weight:600;color:${color}">${RISK_LABELS_TR[building.risk_level]}</span>
            <span style="font-size:11px;color:#94a3b8">— ${building.health_score.toFixed(0)}/100</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:4px">${building.defect_count} hasar tespiti</div>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([building.lng, building.lat])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener('click', () => {
        onBuildingSelect(building);
      });

      markers.current.push(marker);
    });
  }, [buildings, selectedBuildingId, onBuildingSelect, clearMarkers]);

  // Fly to selected building
  useEffect(() => {
    if (!map.current || !selectedBuildingId) return;
    const b = buildings.find(b => b.id === selectedBuildingId);
    if (!b) return;
    map.current.flyTo({
      center: [b.lng, b.lat],
      zoom: 17,
      duration: 1000,
    });
  }, [selectedBuildingId, buildings]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />

      {/* Legend */}
      <div className="absolute bottom-8 right-4 bg-slate-900/90 backdrop-blur-sm rounded-lg p-3 text-xs text-white border border-slate-700">
        <div className="font-semibold mb-2 text-slate-300">Risk Seviyesi</div>
        {(Object.keys(RISK_COLORS) as Array<keyof typeof RISK_COLORS>).map(level => (
          <div key={level} className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: RISK_COLORS[level] }}
            />
            <span className="text-slate-300">{RISK_LABELS_TR[level]}</span>
          </div>
        ))}
      </div>

      {/* Building count badge */}
      {buildings.length > 0 && (
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-slate-300 border border-slate-700">
          {buildings.length} bina analiz edildi
        </div>
      )}
    </div>
  );
}

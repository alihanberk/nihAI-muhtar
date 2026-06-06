import { getApiBaseUrl } from "./api-config";

// RoadScore API client — communicates with Go backend RoadScore endpoints
const API_URL = getApiBaseUrl();

export type DamageCategory = "GOOD" | "FAIR" | "POOR" | "CRITICAL";
export type RouteType = "fastest" | "healthiest" | "balanced";

export interface SegmentScore {
  id: string;
  route_id: string;
  lat: number;
  lng: number;
  damage_score: number;   // 0–100
  damage_category: DamageCategory;
  heading: number;
  confidence: number;
  segment_order: number;
  from_cache: boolean;
  created_at: string;
}

export interface ScoreRoute {
  id: string;
  analysis_id: string;
  route_index: number;
  route_type: RouteType;
  duration_seconds: number;
  distance_meters: number;
  damage_score: number;
  segment_count: number;
  encoded_polyline: string;
  segments: SegmentScore[];
}

export interface AnalyzeResponse {
  analysis_id: string;
  routes: ScoreRoute[];
  recommended_route_id: string;
}

export interface AnalyzeRequest {
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
}

// categoryColor maps a DamageCategory to a Tailwind + hex colour pair
export const categoryColor: Record<DamageCategory, { hex: string; tw: string; label: string }> = {
  GOOD:     { hex: "#22c55e", tw: "bg-green-500",  label: "İyi"      },
  FAIR:     { hex: "#eab308", tw: "bg-yellow-500", label: "Orta"     },
  POOR:     { hex: "#f97316", tw: "bg-orange-500", label: "Kötü"     },
  CRITICAL: { hex: "#ef4444", tw: "bg-red-500",    label: "Kritik"   },
};

export async function analyzeRoute(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_URL}/road-score/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data as AnalyzeResponse;
}

export async function getAnalysis(analysisId: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_URL}/road-score/analysis/${analysisId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data as AnalyzeResponse;
}

export async function getReport(analysisId: string): Promise<unknown> {
  const res = await fetch(`${API_URL}/road-score/analysis/${analysisId}/report`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

// ─── Area Scan ────────────────────────────────────────────────────────────────

export interface AreaScanPoint {
  lat: number;
  lng: number;
  damage_score: number;
  damage_category: DamageCategory;
  confidence: number;
  from_cache: boolean;
}

export interface AreaScanSummary {
  avg_damage_score: number;
  overall_category: DamageCategory;
  good_count: number;
  fair_count: number;
  poor_count: number;
  critical_count: number;
  total_points: number;
  scored_points: number;
  worst_point?: AreaScanPoint;
  best_point?: AreaScanPoint;
}

export interface AreaScanResponse {
  scan_id: string;
  neighborhood_name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  points: AreaScanPoint[];
  summary: AreaScanSummary;
  duration_ms: number;
}

export interface AreaScanRequest {
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  neighborhood_name: string;
}

export async function scanArea(req: AreaScanRequest): Promise<AreaScanResponse> {
  const res = await fetch(`${API_URL}/road-score/scan-area`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    // Area scans can take up to 5 minutes with many Street View calls
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json.data as AreaScanResponse;
}

/** Decode a Google-encoded polyline to [lng, lat] coordinate pairs for Mapbox */
export function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    lat += decodeChunk(encoded, { index });
    lng += decodeChunk(encoded, { index });
    coords.push([lng / 1e5, lat / 1e5]);
    index += 0; // cursor managed inside decodeChunk via ref
  }

  return coords;
}

// decodeChunk decodes one coordinate delta from the encoded string
function decodeChunk(encoded: string, cursor: { index: number }): number {
  let result = 0, shift = 0, b: number;
  do {
    b = encoded.charCodeAt(cursor.index++) - 63;
    result |= (b & 0x1f) << shift;
    shift += 5;
  } while (b >= 0x20);
  return result & 1 ? ~(result >> 1) : result >> 1;
}

/** Decode a polyline string and return a GeoJSON LineString coordinate array */
export function polylineToGeoJSON(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
}

/** Format seconds to "X dk Y s" Turkish string */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} dk ${s} s` : `${m} dk`;
}

/** Format meters to "X.X km" or "X m" */
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

/** Map route type to Turkish label */
export const routeTypeLabel: Record<RouteType, string> = {
  fastest:    "En Hızlı",
  healthiest: "En Sağlam",
  balanced:   "Denge",
};

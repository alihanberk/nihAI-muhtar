import { apiClient } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HeatRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface GridCell {
  id: string;
  scan_id: string;
  lat: number;
  lng: number;
  green_score: number;
  vegetation_pct: number;
  sky_pct: number;
  building_pct: number;
  road_pct: number;
  sidewalk_pct: number;
  concrete_ratio: number;
  heat_risk: HeatRiskLevel;
  from_cache: boolean;
  processed_at: string;
}

export interface AirlensScan {
  id: string;
  district_name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  total_cells: number;
  scored_cells: number;
  avg_green_score: number;
  heat_risk_level: HeatRiskLevel;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  duration_ms: number;
  created_at: string;
  completed_at?: string;
  cells?: GridCell[];
}

export interface ScanRequest {
  district_name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
}

export interface ScanReport {
  scan_id: string;
  district: string;
  avg_green: number;
  heat_risk: HeatRiskLevel;
  scored_cells: number;
  duration_ms: number;
  distribution: Record<HeatRiskLevel, number>;
  top_green: GridCell[];
  hotspots: GridCell[];
}

export interface Waypoint {
  lat: number;
  lng: number;
  green_score: number;
  order: number;
}

export interface CoolRoute {
  waypoints: Waypoint[];
  total_distance_m: number;
  avg_green_score: number;
  description: string;
}

export interface ListScansResponse {
  district: string;
  scans: AirlensScan[];
  count: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const airlensApi = {
  /** Start a new district greenery scan (may take several minutes). */
  scanDistrict: (req: ScanRequest): Promise<AirlensScan> =>
    apiClient.post<AirlensScan>('/airlens/scan', req),

  /** Get a scan by ID including all grid cells. */
  getScan: (scanId: string): Promise<AirlensScan> =>
    apiClient.get<AirlensScan>(`/airlens/scans/${scanId}`),

  /** List recent scans for a district. */
  listScans: (district: string): Promise<ListScansResponse> =>
    apiClient.get<ListScansResponse>(`/airlens/scans?district=${encodeURIComponent(district)}`),

  /** Get the full report for a scan (top green + hotspots + distribution). */
  getScanReport: (scanId: string): Promise<ScanReport> =>
    apiClient.get<ScanReport>(`/airlens/scans/${scanId}/report`),

  /** Get the recommended cool walking route for a scan. */
  getCoolRoute: (scanId: string): Promise<CoolRoute> =>
    apiClient.get<CoolRoute>(`/airlens/scans/${scanId}/cool-route`),
};

// ─── Colour helpers ───────────────────────────────────────────────────────────

/** Maps a green score (0–100) to a choropleth hex colour. */
export function greenScoreToColor(score: number): string {
  if (score >= 40) return '#1a9850'; // dark green
  if (score >= 25) return '#91cf60'; // light green
  if (score >= 15) return '#fee08b'; // yellow
  if (score >= 8)  return '#f46d43'; // orange
  return '#d73027';                  // red
}

export const HEAT_RISK_COLORS: Record<HeatRiskLevel, string> = {
  LOW:      '#1a9850',
  MODERATE: '#fee08b',
  HIGH:     '#f46d43',
  CRITICAL: '#d73027',
};

export const HEAT_RISK_LABELS: Record<HeatRiskLevel, string> = {
  LOW:      'Düşük Risk',
  MODERATE: 'Orta Risk',
  HIGH:     'Yüksek Risk',
  CRITICAL: 'Kritik Risk',
};

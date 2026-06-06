export type DefectType =
  | 'structural_crack'
  | 'spalling'
  | 'corrosion_stain'
  | 'deformed_balcony'
  | 'damaged_fire_escape'
  | 'building_tilt'
  | 'frame_deformation';

export type RiskLevel = 'HEALTHY' | 'ATTENTION' | 'RISKY' | 'EMERGENCY';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface FacadeDefect {
  id: string;
  building_id: string;
  defect_type: DefectType;
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  uncertain: boolean;
  bounding_box: BoundingBox;
  label: string;
  created_at: string;
}

export interface BuildingAnalysis {
  id: string;
  job_id: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  heading: number;
  street_view_url: string;
  health_score: number;
  risk_level: RiskLevel;
  defect_count: number;
  defects?: FacadeDefect[];
  needs_human_review: boolean;
  analysis_year: number;
  created_at: string;
  updated_at: string;
}

export interface AnalysisJob {
  id: string;
  district: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  status: JobStatus;
  total_count: number;
  done_count: number;
  error_msg?: string;
  created_at: string;
  updated_at: string;
}

export interface DistrictHeatmap {
  district: string;
  total_buildings: number;
  healthy_count: number;
  attention_count: number;
  risky_count: number;
  emergency_count: number;
  avg_health_score: number;
  updated_at: string;
}

export interface CitizenReport {
  id: string;
  building_id: string;
  lat: number;
  lng: number;
  description: string;
  photo_url: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
}

export interface FacadeBuildingReport {
  generated_at: string;
  building_id: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  health_score: number;
  risk_level: RiskLevel;
  risk_color: string;
  defects: FacadeDefect[];
  defect_summary: Record<string, number>;
  citizen_reports: CitizenReport[];
  recommendation: string;
  analysis_year: number;
  source: string;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const RISK_COLORS: Record<RiskLevel, string> = {
  HEALTHY: '#22c55e',
  ATTENTION: '#eab308',
  RISKY: '#f97316',
  EMERGENCY: '#ef4444',
};

export const RISK_LABELS_TR: Record<RiskLevel, string> = {
  HEALTHY: 'Sağlıklı',
  ATTENTION: 'Dikkat',
  RISKY: 'Riskli',
  EMERGENCY: 'Acil',
};

export const DEFECT_LABELS_TR: Record<DefectType, string> = {
  structural_crack: 'Yapısal Çatlak',
  spalling: 'Yüzey Dökülmesi',
  corrosion_stain: 'Pas / Nem Lekesi',
  deformed_balcony: 'Eğik / Çökmüş Balkon',
  damaged_fire_escape: 'Hasarlı Yangın Merdiveni',
  building_tilt: 'Bina Eğimi',
  frame_deformation: 'Çerçeve Bozukluğu',
};

export const DEFECT_ICONS: Record<DefectType, string> = {
  structural_crack: '⚡',
  spalling: '🧱',
  corrosion_stain: '🔴',
  deformed_balcony: '🏚️',
  damaged_fire_escape: '🚒',
  building_tilt: '📐',
  frame_deformation: '🪟',
};

export function severityLabel(s: number): string {
  return ['', 'Çok Hafif', 'Hafif', 'Orta', 'Ağır', 'Kritik'][s] ?? 'Bilinmiyor';
}

export function severityColor(s: number): string {
  const colors = ['', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
  return colors[s] ?? '#6b7280';
}

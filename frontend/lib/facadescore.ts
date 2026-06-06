import type {
  AnalysisJob,
  BuildingAnalysis,
  CitizenReport,
  DistrictHeatmap,
  FacadeBuildingReport,
} from '@/types/facadescore';
import { getApiBaseUrl } from './api-config';

const API_BASE = getApiBaseUrl();

interface ApiResponse<T> {
  data: T;
  message?: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const text = await res.text();
  let json: ApiResponse<T> & Record<string, unknown>;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      res.ok
        ? 'Sunucu geçersiz yanıt döndürdü'
        : `API hatası (HTTP ${res.status}): ${text.slice(0, 120)}`
    );
  }

  if (!res.ok) {
    const msg =
      (typeof json.message === 'string' && json.message) ||
      (typeof json.error === 'string' && json.error) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json.data;
}

// ─── Analysis jobs ────────────────────────────────────────────────────────────

export interface AnalyzeDistrictParams {
  district: string;
  center_lat: number;
  center_lng: number;
  radius_m?: number;
}

export async function analyzeDistrict(params: AnalyzeDistrictParams): Promise<{ job_id: string; district: string; message: string }> {
  return apiFetch('/facade-score/analyze', {
    method: 'POST',
    body: JSON.stringify({ ...params, radius_m: params.radius_m ?? 500 }),
  });
}

export async function getJob(jobId: string): Promise<AnalysisJob> {
  return apiFetch(`/facade-score/jobs/${jobId}`);
}

// ─── Buildings ────────────────────────────────────────────────────────────────

export async function getBuilding(buildingId: string): Promise<BuildingAnalysis> {
  return apiFetch(`/facade-score/buildings/${buildingId}`);
}

export async function listBuildingsByDistrict(district: string): Promise<BuildingAnalysis[]> {
  return apiFetch(`/facade-score/districts/${encodeURIComponent(district)}/buildings`);
}

export async function getPriorityBuildings(limit = 20): Promise<BuildingAnalysis[]> {
  return apiFetch(`/facade-score/priority?limit=${limit}`);
}

export async function getBuildingReport(buildingId: string): Promise<FacadeBuildingReport> {
  return apiFetch(`/facade-score/buildings/${buildingId}/report`);
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

export async function getAllHeatmaps(): Promise<DistrictHeatmap[]> {
  return apiFetch('/facade-score/heatmap');
}

export async function getDistrictHeatmap(district: string): Promise<DistrictHeatmap> {
  return apiFetch(`/facade-score/heatmap/${encodeURIComponent(district)}`);
}

// ─── Citizen reports ─────────────────────────────────────────────────────────

export interface CitizenReportParams {
  building_id?: string;
  lat: number;
  lng: number;
  description: string;
  photo_url?: string;
}

export async function submitCitizenReport(params: CitizenReportParams): Promise<CitizenReport> {
  return apiFetch('/facade-score/citizen-report', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ─── PDF export ───────────────────────────────────────────────────────────────

export async function exportReportAsPdf(
  report: FacadeBuildingReport,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsPDF: any
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('nihAI Muhtar — FacadeScore Bina Raporu', 10, 12);
  doc.setFontSize(9);
  doc.text(`Oluşturulma: ${new Date(report.generated_at).toLocaleString('tr-TR')}`, 10, 22);

  // Building info
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.text(`${report.district} — ${report.address || report.building_id}`, 10, 38);

  doc.setFontSize(11);
  doc.text(`Sağlık Skoru: ${report.health_score.toFixed(1)} / 100`, 10, 50);
  doc.text(`Risk Seviyesi: ${report.risk_level}`, 10, 58);
  doc.text(`Tespit Yılı: ${report.analysis_year}`, 10, 66);

  // Recommendation box
  doc.setFillColor(254, 249, 195);
  doc.rect(10, 72, pageWidth - 20, 16, 'F');
  doc.setFontSize(10);
  doc.setTextColor(92, 72, 0);
  doc.text(`Öneri: ${report.recommendation}`, 14, 82, { maxWidth: pageWidth - 28 });

  // Defects table header
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.text('Tespit Edilen Hasarlar', 10, 98);

  let y = 106;
  doc.setFontSize(9);
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y - 5, pageWidth - 20, 8, 'F');
  doc.text('Hasar Türü', 12, y);
  doc.text('Şiddet', 80, y);
  doc.text('Güven', 110, y);
  doc.text('Belirsiz', 140, y);

  y += 8;
  for (const defect of report.defects) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(30, 41, 59);
    doc.text(defect.defect_type, 12, y);
    doc.text(`${defect.severity} / 5`, 80, y);
    doc.text(`${(defect.confidence * 100).toFixed(0)}%`, 110, y);
    doc.text(defect.uncertain ? 'Evet' : 'Hayır', 140, y);
    y += 7;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(report.source, 10, 285);

  doc.save(`facade-report-${report.building_id.slice(0, 8)}.pdf`);
}

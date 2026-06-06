'use client';

import { useState } from 'react';
import type { BuildingAnalysis, FacadeDefect, FacadeBuildingReport } from '@/types/facadescore';
import {
  RISK_COLORS,
  RISK_LABELS_TR,
  DEFECT_LABELS_TR,
  DEFECT_ICONS,
  severityLabel,
  severityColor,
} from '@/types/facadescore';
import DefectOverlay from './DefectOverlay';
import { getBuildingReport, exportReportAsPdf } from '@/lib/facadescore';

interface BuildingPanelProps {
  building: BuildingAnalysis;
  onClose: () => void;
}

export default function BuildingPanel({ building, onClose }: BuildingPanelProps) {
  const [activeTab, setActiveTab] = useState<'defects' | 'streetview' | 'report'>('streetview');
  const [selectedDefect, setSelectedDefect] = useState<FacadeDefect | null>(null);
  const [report, setReport] = useState<FacadeBuildingReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const riskColor = RISK_COLORS[building.risk_level];

  const handleLoadReport = async () => {
    if (report) {
      setActiveTab('report');
      return;
    }
    setLoadingReport(true);
    try {
      const r = await getBuildingReport(building.id);
      setReport(r);
      setActiveTab('report');
    } catch (err) {
      console.error('Report load failed:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    try {
      const jspdfModule = await import('jspdf');
      const JsPDFClass = jspdfModule.default ?? (jspdfModule as unknown as { jsPDF: unknown }).jsPDF;
      await exportReportAsPdf(report, JsPDFClass);
    } finally {
      setExportingPdf(false);
    }
  };

  const streetViewUrl = building.street_view_url ||
    `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${building.lat},${building.lng}&heading=${building.heading}&fov=90&key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}`;

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-start justify-between"
        style={{ borderBottom: `2px solid ${riskColor}` }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: riskColor, boxShadow: `0 0 8px ${riskColor}` }}
            />
            <span className="text-sm font-bold" style={{ color: riskColor }}>
              {RISK_LABELS_TR[building.risk_level]}
            </span>
            <span className="text-slate-400 text-xs">
              — Skor: {building.health_score.toFixed(1)}/100
            </span>
          </div>
          <div className="text-slate-200 font-semibold text-sm truncate">
            {building.district}
          </div>
          <div className="text-slate-400 text-xs truncate mt-0.5">
            {building.address || `${building.lat.toFixed(5)}, ${building.lng.toFixed(5)}`}
          </div>
          <div className="text-slate-500 text-xs mt-1">
            {building.defect_count} hasar · {building.analysis_year} analizi
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-3 text-slate-400 hover:text-white transition-colors flex-shrink-0 text-xl leading-none"
        >
          ✕
        </button>
      </div>

      {/* Human review badge */}
      {building.needs_human_review && (
        <div className="mx-4 mt-3 bg-yellow-900/40 border border-yellow-600/50 rounded-lg px-3 py-2 text-xs text-yellow-300 flex items-center gap-2">
          <span>⚠️</span>
          <span>Bazı tespitler belirsiz — insan onayı gerekiyor</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-700 mt-3 px-4">
        {(['streetview', 'defects', 'report'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              if (tab === 'report') {
                handleLoadReport();
              } else {
                setActiveTab(tab);
              }
            }}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'streetview' ? '📷 Street View' :
             tab === 'defects' ? `🔍 Hasarlar (${building.defect_count})` :
             '📄 Rapor'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* Street View tab */}
        {activeTab === 'streetview' && (
          <div className="p-4">
            <div className="relative rounded-lg overflow-hidden bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={streetViewUrl}
                alt="Street View"
                className="w-full object-cover"
                style={{ aspectRatio: '4/3' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />

              {/* Defect bounding boxes overlay */}
              {building.defects && building.defects.length > 0 && (
                <DefectOverlay
                  defects={building.defects}
                  selectedDefect={selectedDefect}
                  imageWidth={640}
                  imageHeight={480}
                />
              )}
            </div>

            {/* Quick defect chips */}
            {building.defects && building.defects.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {building.defects.map(defect => (
                  <button
                    key={defect.id}
                    onClick={() => setSelectedDefect(
                      selectedDefect?.id === defect.id ? null : defect
                    )}
                    className={`text-xs px-2 py-1 rounded-full border transition-all ${
                      selectedDefect?.id === defect.id
                        ? 'border-blue-500 bg-blue-900/50 text-blue-300'
                        : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {DEFECT_ICONS[defect.defect_type]} {DEFECT_LABELS_TR[defect.defect_type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Defects tab */}
        {activeTab === 'defects' && (
          <div className="p-4 space-y-3">
            {(building.defects ?? []).length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <div className="text-3xl mb-2">✅</div>
                <div>Bu binada hasar tespit edilmedi</div>
              </div>
            ) : (
              building.defects!.map(defect => (
                <DefectCard key={defect.id} defect={defect} />
              ))
            )}
          </div>
        )}

        {/* Report tab */}
        {activeTab === 'report' && (
          <div className="p-4">
            {loadingReport ? (
              <div className="text-center py-8 text-slate-400">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                Rapor yükleniyor...
              </div>
            ) : report ? (
              <div className="space-y-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="text-sm font-semibold text-slate-300 mb-1">Öneri</div>
                  <div className="text-sm text-slate-100">{report.recommendation}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(report.defect_summary).map(([type, count]) => (
                    <div key={type} className="bg-slate-800 rounded-lg p-3">
                      <div className="text-xs text-slate-400">{DEFECT_ICONS[type as keyof typeof DEFECT_ICONS]} {DEFECT_LABELS_TR[type as keyof typeof DEFECT_LABELS_TR]}</div>
                      <div className="text-xl font-bold text-white mt-1">{count}</div>
                    </div>
                  ))}
                </div>

                {report.citizen_reports.length > 0 && (
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-sm font-semibold text-slate-300 mb-2">
                      Vatandaş Bildirimleri ({report.citizen_reports.length})
                    </div>
                    {report.citizen_reports.map(cr => (
                      <div key={cr.id} className="text-xs text-slate-400 border-t border-slate-700 pt-2 mt-2">
                        {cr.description}
                        <div className="text-slate-600 mt-1">{new Date(cr.created_at).toLocaleDateString('tr-TR')}</div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg text-sm font-medium transition-colors"
                >
                  {exportingPdf ? 'PDF hazırlanıyor...' : '⬇ PDF olarak indir'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function DefectCard({ defect }: { defect: FacadeDefect }) {
  const sColor = severityColor(defect.severity);
  return (
    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{DEFECT_ICONS[defect.defect_type]}</span>
          <span className="text-sm font-medium text-slate-200">
            {DEFECT_LABELS_TR[defect.defect_type]}
          </span>
        </div>
        {defect.uncertain && (
          <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-600/40 px-2 py-0.5 rounded-full">
            Belirsiz
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <span>Şiddet:</span>
          <span className="font-semibold" style={{ color: sColor }}>
            {defect.severity}/5 — {severityLabel(defect.severity)}
          </span>
        </div>
        <div>
          Güven: <span className="text-slate-300">{(defect.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

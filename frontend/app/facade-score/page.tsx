'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type {
  BuildingAnalysis,
  AnalysisJob,
} from '@/types/facadescore';
import { RISK_COLORS, RISK_LABELS_TR } from '@/types/facadescore';
import BuildingPanel from '@/components/facadescore/BuildingPanel';
import {
  analyzeDistrict,
  listBuildingsByDistrict,
  getPriorityBuildings,
  getBuilding,
  getJob,
  submitCitizenReport,
} from '@/lib/facadescore';
import { useNeighborhood } from '@/contexts/NeighborhoodContext';

const FacadeScoreMap = dynamic(
  () => import('@/components/facadescore/FacadeScoreMap'),
  { ssr: false, loading: () => <MapSkeleton /> }
);

type ViewMode = 'neighborhood' | 'priority';

export default function FacadeScorePage() {
  const { neighborhood } = useNeighborhood();
  const [viewMode, setViewMode] = useState<ViewMode>('neighborhood');
  const [buildings, setBuildings] = useState<BuildingAnalysis[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingAnalysis | null>(null);
  const [activeJob, setActiveJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [citizenMode, setCitizenMode] = useState(false);
  const [citizenForm, setCitizenForm] = useState({ description: '', photo_url: '' });
  const [citizenSubmitting, setCitizenSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const mapCenter: [number, number] = neighborhood
    ? [neighborhood.lng, neighborhood.lat]
    : [28.9784, 41.0082];

  const refreshNeighborhood = useCallback(async () => {
    if (!neighborhood) return;
    setLoading(true);
    setApiError(null);
    try {
      const data = await listBuildingsByDistrict(neighborhood.name);
      setBuildings(data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      if (msg.includes('500') || msg.toLowerCase().includes('table')) {
        setApiError('Veritabanı tabloları henüz oluşturulmamış. Migration çalıştırın: make migrate-up');
      } else if (msg.includes('404')) {
        setBuildings([]);
      } else {
        setApiError(`API hatası: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }, [neighborhood]);

  // Auto-load buildings when neighborhood is available and in neighborhood view
  useEffect(() => {
    if (neighborhood && viewMode === 'neighborhood') {
      refreshNeighborhood();
    }
  }, [neighborhood, viewMode, refreshNeighborhood]);

  // Poll active job
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const job = await getJob(activeJob.id);
        setActiveJob(job);

        const pct = job.total_count > 0
          ? Math.round((job.done_count / job.total_count) * 100)
          : 0;
        setStatusMsg(`Analiz ediliyor... ${pct}% (${job.done_count}/${job.total_count})`);

        if (job.status === 'completed') {
          setStatusMsg('');
          await refreshNeighborhood();
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob, refreshNeighborhood]);

  const handleStartAnalysis = async () => {
    if (!neighborhood) return;

    setLoading(true);
    setApiError(null);
    setStatusMsg('Analiz başlatılıyor...');
    try {
      const res = await analyzeDistrict({
        district: neighborhood.name,
        center_lat: neighborhood.lat,
        center_lng: neighborhood.lng,
        radius_m: neighborhood.radius,
      });
      const job = await getJob(res.job_id);
      setActiveJob(job);
      setViewMode('neighborhood');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      setStatusMsg('');
      setApiError(`Analiz başlatılamadı: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPriority = async () => {
    setLoading(true);
    setViewMode('priority');
    try {
      const data = await getPriorityBuildings(20);
      setBuildings(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildingSelect = async (b: BuildingAnalysis) => {
    // List endpoints don't include defects; fetch the full record so the
    // detail panel can show bounding boxes and the defect tab.
    setSelectedBuilding(b); // show immediately with available data
    try {
      const full = await getBuilding(b.id);
      setSelectedBuilding(full);
    } catch {
      // keep the partial record already shown
    }
  };

  const handleCitizenReport = async () => {
    if (!selectedBuilding || !citizenForm.description) return;
    setCitizenSubmitting(true);
    try {
      await submitCitizenReport({
        building_id: selectedBuilding.id,
        lat: selectedBuilding.lat,
        lng: selectedBuilding.lng,
        description: citizenForm.description,
        photo_url: citizenForm.photo_url,
      });
      setCitizenMode(false);
      setCitizenForm({ description: '', photo_url: '' });
      setStatusMsg('Bildiriminiz alındı. Teşekkürler!');
      setTimeout(() => setStatusMsg(''), 4000);
    } finally {
      setCitizenSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">
        {/* Logo / title */}
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏚️</span>
            <div>
              <div className="font-bold text-white text-base leading-tight">FacadeScore</div>
              <div className="text-xs text-slate-400">Yapı Sağlığı Haritası</div>
            </div>
          </div>
        </div>

        {/* View mode tabs */}
        <div className="flex border-b border-slate-800">
          {([['neighborhood', '🗺️ Mahalle'], ['priority', '🚨 Acil 20']] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                if (mode === 'priority') handleLoadPriority();
              }}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Neighborhood info */}
        <div className="p-4 border-b border-slate-800">
          {neighborhood ? (
            <>
              <div className="text-xs text-slate-400 mb-1.5">Aktif Mahalle</div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 mb-2">
                <div className="text-sm font-medium text-white">{neighborhood.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{neighborhood.district}</div>
              </div>
              <button
                onClick={handleStartAnalysis}
                disabled={loading || (!!activeJob && activeJob.status === 'processing')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Başlatılıyor...' : '🔍 Analizi Başlat'}
              </button>
            </>
          ) : (
            <div className="text-xs text-slate-500 text-center py-2">
              Mahalle seçilmedi. Dashboard&apos;dan mahalle seçin.
            </div>
          )}

          {statusMsg && (
            <div className="mt-2 text-xs text-blue-400 animate-pulse">{statusMsg}</div>
          )}

          {apiError && (
            <div className="mt-2 bg-red-900/40 border border-red-600/50 rounded-lg px-3 py-2 text-xs text-red-300">
              <div className="font-semibold mb-0.5">⚠️ Hata</div>
              <div>{apiError}</div>
              <button
                onClick={() => setApiError(null)}
                className="mt-1 text-red-400 hover:text-red-200 underline"
              >
                Kapat
              </button>
            </div>
          )}
        </div>

        {/* Building list */}
        {(viewMode === 'neighborhood' || viewMode === 'priority') && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="text-xs text-slate-500 font-semibold px-1 mb-2">
              {viewMode === 'priority' ? 'ACİL İNCELEME GEREKENLEr' : `${neighborhood?.name?.toUpperCase() ?? ''} BİNALARI`}
              {buildings.length > 0 && <span className="ml-2 text-slate-600">({buildings.length})</span>}
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : buildings.length === 0 ? (
              <div className="text-center py-8 text-slate-600 text-sm">
                Henüz analiz verisi yok.
              </div>
            ) : (
              buildings.map(b => (
                <button
                  key={b.id}
                  onClick={() => handleBuildingSelect(b)}
                  className={`w-full text-left rounded-lg p-3 transition-all border ${
                    selectedBuilding?.id === b.id
                      ? 'border-blue-500 bg-blue-950/40'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: RISK_COLORS[b.risk_level] + '33',
                        color: RISK_COLORS[b.risk_level],
                        border: `1px solid ${RISK_COLORS[b.risk_level]}55`,
                      }}
                    >
                      {RISK_LABELS_TR[b.risk_level]}
                    </span>
                    <span className="text-xs text-slate-400">{b.health_score.toFixed(0)}/100</span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {b.address || `${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}`}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {b.defect_count} hasar {b.needs_human_review ? '· ⚠️ insan onayı' : ''}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-5">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>
              {viewMode === 'neighborhood' && neighborhood && `${neighborhood.name} — Bina Analizi`}
              {viewMode === 'neighborhood' && !neighborhood && 'Mahalle seçilmedi'}
              {viewMode === 'priority' && 'Acil İnceleme Gereken 20 Bina'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {selectedBuilding && (
              <button
                onClick={() => setCitizenMode(true)}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors font-medium"
              >
                📢 Bu Binayı İhbar Et
              </button>
            )}
            <span className="text-slate-500">
              KVKK uyumlu · Yüzler bulanıklaştırılmış · Ham görüntüler 24s'te silinir
            </span>
          </div>
        </div>

        {/* Map + panel layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map */}
          <div className={`transition-all duration-300 ${selectedBuilding ? 'flex-1' : 'w-full'} h-full p-4`}>
            <FacadeScoreMap
              buildings={buildings}
              selectedBuildingId={selectedBuilding?.id ?? null}
              onBuildingSelect={handleBuildingSelect}
              center={mapCenter}
              neighborhood={neighborhood ? {
                lat: neighborhood.lat,
                lng: neighborhood.lng,
                radius: neighborhood.radius,
                name: neighborhood.name,
              } : undefined}
            />
          </div>

          {/* Building detail panel */}
          {selectedBuilding && (
            <div className="w-96 shrink-0 border-l border-slate-800 overflow-hidden">
              <BuildingPanel
                building={selectedBuilding}
                onClose={() => setSelectedBuilding(null)}
              />
            </div>
          )}
        </div>
      </main>

      {/* Citizen report modal */}
      {citizenMode && selectedBuilding && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">📢 Bina Bildirimi</h3>
              <button onClick={() => setCitizenMode(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="text-sm text-slate-400 mb-4">
              {selectedBuilding.district} — {selectedBuilding.address || 'Seçili bina'}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Açıklama *</label>
                <textarea
                  value={citizenForm.description}
                  onChange={e => setCitizenForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Gördüğünüz hasarı kısaca açıklayın..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fotoğraf URL (isteğe bağlı)</label>
                <input
                  type="url"
                  value={citizenForm.photo_url}
                  onChange={e => setCitizenForm(f => ({ ...f, photo_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setCitizenMode(false)}
                className="flex-1 py-2 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleCitizenReport}
                disabled={!citizenForm.description || citizenSubmitting}
                className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {citizenSubmitting ? 'Gönderiliyor...' : 'Bildir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="w-full h-full bg-slate-800 rounded-xl animate-pulse flex items-center justify-center">
      <div className="text-slate-600 text-sm">Harita yükleniyor...</div>
    </div>
  );
}

"use client";

import { useState, useCallback, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeRoute,
  getReport,
  AnalyzeResponse,
  ScoreRoute,
  SegmentScore,
  categoryColor,
} from "@/lib/roadscore";

const RoadScoreMap = lazy(() => import("@/components/map/RoadScoreMap"));
const RouteCard = lazy(() => import("@/components/roadscore/RouteCard"));
const SegmentDetail = lazy(() => import("@/components/roadscore/SegmentDetail"));
const LocationSearch = lazy(() => import("@/components/roadscore/LocationSearch"));

interface NamedPoint {
  name: string;
  lat: number;
  lng: number;
}

export default function RoadScorePage() {
  const router = useRouter();

  // Location state (replaces raw lat/lng inputs)
  const [origin, setOrigin] = useState<NamedPoint | null>(null);
  const [destination, setDestination] = useState<NamedPoint | null>(null);
  const [originName, setOriginName] = useState("");
  const [destName, setDestName] = useState("");

  // Map click mode: which point is being placed?
  const [clickMode, setClickMode] = useState<"origin" | "destination" | null>(null);

  // Analysis state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<{
    segment: SegmentScore;
    route: ScoreRoute;
  } | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);

  // Quick-fill shortcuts
  const quickFill = (name: string) => {
    const coords: Record<string, [string, number, number, string, number, number]> = {
      taksim_besiktas: ["Taksim Meydanı, İstanbul", 41.0370, 28.9850, "Beşiktaş, İstanbul", 41.0430, 29.0065],
      kadikoy_uskudar: ["Kadıköy, İstanbul",        40.9905, 29.0220, "Üsküdar, İstanbul",  41.0210, 29.0140],
      levent_maslak:   ["Levent, İstanbul",          41.0790, 29.0110, "Maslak, İstanbul",   41.1080, 29.0190],
    };
    const c = coords[name];
    if (!c) return;
    setOriginName(c[0] as string);
    setOrigin({ name: c[0] as string, lat: c[1] as number, lng: c[2] as number });
    setDestName(c[3] as string);
    setDestination({ name: c[3] as string, lat: c[4] as number, lng: c[5] as number });
  };

  // Map click handler
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const name = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (clickMode === "origin") {
      setOrigin({ name, lat, lng });
      setOriginName(name);
      setClickMode("destination"); // auto-advance to destination
    } else if (clickMode === "destination") {
      setDestination({ name, lat, lng });
      setDestName(name);
      setClickMode(null);
    }
  }, [clickMode]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) {
      setError("Lütfen başlangıç ve bitiş noktalarını seçin.");
      return;
    }
    setError(null);
    setResult(null);
    setActiveRouteId(null);
    setSelectedSegment(null);
    setLoading(true);
    try {
      const data = await analyzeRoute({
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
      });
      setResult(data);
      setActiveRouteId(data.recommended_route_id ?? data.routes[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analiz başarısız oldu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSegmentClick = useCallback((segment: SegmentScore, route: ScoreRoute) => {
    setSelectedSegment({ segment, route });
  }, []);

  const handleDownloadPDF = async () => {
    if (!result) return;
    setPdfLoading(true);

    try {
      const report = await getReport(result.analysis_id);
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });

      // Header
      doc.setFillColor(17, 24, 39);
      doc.rect(0, 0, 210, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text("nihAI Muhtar — RoadScore Raporu", 14, 18);
      doc.setFontSize(10);
      doc.text(`Analiz ID: ${result.analysis_id}`, 14, 28);
      doc.text(`Tarih: ${new Date().toLocaleDateString("tr-TR")}`, 14, 35);

      let y = 50;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text("Rota Karşılaştırması", 14, y);
      y += 8;

      result.routes.forEach((route, i) => {
        const r = report as { routes?: Array<Record<string, number | string>> };
        const rData = r.routes?.[i] ?? {};

        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text(
          `${i + 1}. Rota — ${route.route_type.toUpperCase()}`,
          14,
          y
        );
        y += 6;
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`  Süre: ${Math.round(route.duration_seconds / 60)} dk | Mesafe: ${(route.distance_meters / 1000).toFixed(1)} km | Hasar: ${route.damage_score.toFixed(0)}%`, 14, y);
        y += 5;
        doc.text(`  Kritik Segmentler: ${rData.critical_count ?? 0} | Kötü: ${rData.poor_count ?? 0} | Orta: ${rData.fair_count ?? 0} | İyi: ${rData.good_count ?? 0}`, 14, y);
        y += 8;
      });

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("Bu rapor nihAI Muhtar tarafından otomatik üretilmiştir. Cursor Hackathon 2026.", 14, 285);

      doc.save(`roadscore-${result.analysis_id.slice(0, 8)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const activeRoute = result?.routes.find((r) => r.id === activeRouteId);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-white/50 hover:text-white transition-colors text-sm"
          >
            ← Dashboard
          </button>
          <span className="text-white/20">|</span>
          <h1 className="font-bold text-lg tracking-tight">
            <span className="text-blue-400">Road</span>
            <span className="text-white">Score</span>
          </h1>
        </div>
        {result && (
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-50"
          >
            {pdfLoading ? "⏳ Hazırlanıyor…" : "📄 PDF Rapor"}
          </button>
        )}
      </header>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-57px)]">
        {/* ── Left sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-full lg:w-96 flex-shrink-0 bg-zinc-900 border-r border-white/5 flex flex-col overflow-hidden">
          {/* Input form */}
          <form onSubmit={handleAnalyze} className="p-4 border-b border-white/5 space-y-3">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Rota Analizi</p>

            <Suspense fallback={null}>
              <LocationSearch
                label="Başlangıç noktası"
                placeholder="Adres veya yer ara…"
                value={originName}
                icon="🟢"
                onSelect={(name, lat, lng) => {
                  setOriginName(name);
                  setOrigin({ name, lat, lng });
                }}
              />
              <LocationSearch
                label="Bitiş noktası"
                placeholder="Adres veya yer ara…"
                value={destName}
                icon="🔴"
                onSelect={(name, lat, lng) => {
                  setDestName(name);
                  setDestination({ name, lat, lng });
                }}
              />
            </Suspense>

            {/* Map click mode buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setClickMode(clickMode === "origin" ? null : "origin")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  clickMode === "origin"
                    ? "bg-green-500/20 border-green-500/50 text-green-400"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                }`}
              >
                {clickMode === "origin" ? "🎯 Haritaya tıkla" : "📍 Haritadan seç (A)"}
              </button>
              <button
                type="button"
                onClick={() => setClickMode(clickMode === "destination" ? null : "destination")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  clickMode === "destination"
                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                }`}
              >
                {clickMode === "destination" ? "🎯 Haritaya tıkla" : "📍 Haritadan seç (B)"}
              </button>
            </div>

            {/* Quick-fill shortcuts */}
            <div>
              <p className="text-xs text-white/30 mb-1.5">Hızlı seç:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Taksim → Beşiktaş", key: "taksim_besiktas" },
                  { label: "Kadıköy → Üsküdar", key: "kadikoy_uskudar" },
                  { label: "Levent → Maslak",   key: "levent_maslak"   },
                ].map(({ label, key }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => quickFill(key)}
                    className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors border border-white/5"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected points summary */}
            {(origin || destination) && (
              <div className="space-y-1">
                {origin && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-400">A</span>
                    <span className="text-white/60 truncate">{origin.name}</span>
                  </div>
                )}
                {destination && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-400">B</span>
                    <span className="text-white/60 truncate">{destination.name}</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !origin || !destination}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analiz ediliyor…
                </span>
              ) : (
                "Rotaları Analiz Et"
              )}
            </button>
          </form>

          {/* Loading progress */}
          {loading && (
            <div className="p-4 space-y-3 border-b border-white/5">
              <LoadingStep label="Google Directions API" done />
              <LoadingStep label="Street View görüntüleri indiriliyor" active />
              <LoadingStep label="KVKK blur uygulanıyor" />
              <LoadingStep label="HuggingFace AI analizi" />
              <LoadingStep label="Rota skorları hesaplanıyor" />
            </div>
          )}

          {/* Route cards */}
          {result && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs font-medium text-white/50 uppercase tracking-wider">3 Rota Seçeneği</p>

              <Suspense fallback={<div className="text-white/30 text-sm">Yükleniyor…</div>}>
                {result.routes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    isActive={route.id === activeRouteId}
                    isRecommended={route.id === result.recommended_route_id}
                    onClick={() => setActiveRouteId(route.id)}
                  />
                ))}
              </Suspense>

              {/* Legend */}
              <div className="rounded-xl border border-white/5 p-3 mt-2">
                <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wide">Renk Lejandı</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.entries(categoryColor) as [keyof typeof categoryColor, (typeof categoryColor)[keyof typeof categoryColor]][]).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: val.hex }} />
                      <span className="text-xs text-white/60">{val.label} ({key})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-3xl">
                🛣
              </div>
              <p className="text-white/40 text-sm max-w-48 leading-relaxed">
                Başlangıç ve bitiş koordinatlarını girerek rota yüzey kalitesini analiz edin.
              </p>
            </div>
          )}
        </aside>

        {/* ── Map area ──────────────────────────────────────────────────────── */}
        <main className="flex-1 relative bg-zinc-950">
          {/* Map is always shown; routes/markers are overlaid as they become available */}
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-white/30">
                Harita yükleniyor…
              </div>
            }
          >
            <RoadScoreMap
              routes={result?.routes ?? []}
              activeRouteId={activeRouteId}
              onSegmentClick={handleSegmentClick}
              markers={[
                ...(origin ? [{ lat: origin.lat, lng: origin.lng, label: "A" as const }] : []),
                ...(destination ? [{ lat: destination.lat, lng: destination.lng, label: "B" as const }] : []),
              ]}
              onMapClick={handleMapClick}
              clickMode={clickMode}
            />

            {/* Click mode hint overlay */}
            {clickMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-white/20 rounded-xl px-4 py-2 text-sm text-white pointer-events-none shadow-xl">
                🎯 {clickMode === "origin" ? "Başlangıç noktasını" : "Bitiş noktasını"} haritaya tıklayarak seç
              </div>
            )}

            {/* No-analysis placeholder (only when no result and no click mode) */}
            {!result && !clickMode && !origin && !destination && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 text-center border border-white/10">
                  <div className="text-4xl mb-2">🗺</div>
                  <p className="text-white/50 text-sm">Soldaki formu doldur veya haritaya tıkla</p>
                </div>
              </div>
            )}

            {/* Active route stats overlay */}
            {result && activeRoute && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-6 shadow-xl pointer-events-none">
                <OverlayStat label="Süre" value={`${Math.round(activeRoute.duration_seconds / 60)} dk`} />
                <div className="w-px h-8 bg-white/10" />
                <OverlayStat label="Mesafe" value={`${(activeRoute.distance_meters / 1000).toFixed(1)} km`} />
                <div className="w-px h-8 bg-white/10" />
                <OverlayStat
                  label="Hasar"
                  value={`${activeRoute.damage_score.toFixed(0)}%`}
                  valueColor={categoryColor[getCategory(activeRoute.damage_score)].hex}
                />
                <div className="w-px h-8 bg-white/10" />
                <OverlayStat label="Segmentler" value={`${activeRoute.segment_count}`} />
              </div>
            )}
          </Suspense>
        </main>
      </div>

      {/* Segment detail modal */}
      {selectedSegment && (
        <Suspense fallback={null}>
          <SegmentDetail
            segment={selectedSegment.segment}
            route={selectedSegment.route}
            onClose={() => setSelectedSegment(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function LoadingStep({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-4 h-4 flex-shrink-0 text-center">
        {done ? (
          <span className="text-green-400 text-xs">✓</span>
        ) : active ? (
          <span className="inline-block w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-white/10 mx-auto mt-1" />
        )}
      </span>
      <span className={`text-xs ${done ? "text-green-400" : active ? "text-white" : "text-white/30"}`}>
        {label}
      </span>
    </div>
  );
}

function OverlayStat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-white/40">{label}</p>
      <p className="text-sm font-bold" style={valueColor ? { color: valueColor } : { color: "white" }}>
        {value}
      </p>
    </div>
  );
}

function getCategory(score: number) {
  if (score < 25) return "GOOD" as const;
  if (score < 50) return "FAIR" as const;
  if (score < 75) return "POOR" as const;
  return "CRITICAL" as const;
}

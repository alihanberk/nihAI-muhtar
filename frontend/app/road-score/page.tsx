"use client";

import { useState, useCallback, lazy, Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeRoute,
  scanArea,
  getReport,
  AnalyzeResponse,
  AreaScanResponse,
  AreaScanPoint,
  ScoreRoute,
  SegmentScore,
  categoryColor,
} from "@/lib/roadscore";
import { useNeighborhood } from "@/contexts/NeighborhoodContext";
import { isInsideNeighborhood } from "@/data/neighborhoods";

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
  const { neighborhood } = useNeighborhood();

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
  const [showAllRoads, setShowAllRoads] = useState(false);

  // ── Area scan state ───────────────────────────────────────────────────────
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<AreaScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanPoints, setScanPoints] = useState<AreaScanPoint[]>([]);
  // Transient "out of bounds" flash message (auto-clears)
  const [boundsWarning, setBoundsWarning] = useState(false);

  // Helper: returns true when a point is within the neighborhood circle
  const isWithinBounds = useCallback((lat: number, lng: number): boolean => {
    if (!neighborhood) return true;
    return isInsideNeighborhood(lat, lng, neighborhood);
  }, [neighborhood]);

  const showBoundsWarning = useCallback(() => {
    setBoundsWarning(true);
    setTimeout(() => setBoundsWarning(false), 2500);
  }, []);

  // Quick-fill shortcuts — radius-aware, guaranteed to stay inside circle
  const quickFillOptions = useMemo(() => {
    if (neighborhood) {
      const { lat, lng, name, radius } = neighborhood;
      // Use 40% of radius so diagonal routes stay well within the circle
      const latOff = (radius * 0.40) / 111320;
      const lngOff = (radius * 0.40) / (111320 * Math.cos((lat * Math.PI) / 180));
      return [
        {
          label: `${name}: Kuzey → Güney`,
          origin: { name: `${name} (Kuzey)`, lat: lat + latOff, lng },
          dest:   { name: `${name} (Güney)`, lat: lat - latOff, lng },
        },
        {
          label: `${name}: Doğu → Batı`,
          origin: { name: `${name} (Doğu)`, lat, lng: lng + lngOff },
          dest:   { name: `${name} (Batı)`, lat, lng: lng - lngOff },
        },
        {
          label: `${name}: Merkez çapraz`,
          origin: { name: `${name} (KD)`, lat: lat + latOff * 0.8, lng: lng + lngOff * 0.8 },
          dest:   { name: `${name} (GB)`, lat: lat - latOff * 0.8, lng: lng - lngOff * 0.8 },
        },
      ];
    }
    return [
      { label: "Taksim → Beşiktaş", origin: { name: "Taksim Meydanı", lat: 41.0370, lng: 28.9850 }, dest: { name: "Beşiktaş", lat: 41.0430, lng: 29.0065 } },
      { label: "Kadıköy → Üsküdar", origin: { name: "Kadıköy",        lat: 40.9905, lng: 29.0220 }, dest: { name: "Üsküdar",  lat: 41.0210, lng: 29.0140 } },
      { label: "Levent → Maslak",   origin: { name: "Levent",          lat: 41.0790, lng: 29.0110 }, dest: { name: "Maslak",   lat: 41.1080, lng: 29.0190 } },
    ];
  }, [neighborhood]);

  const quickFill = (idx: number) => {
    const opt = quickFillOptions[idx];
    if (!opt) return;
    setOriginName(opt.origin.name);
    setOrigin(opt.origin);
    setDestName(opt.dest.name);
    setDestination(opt.dest);
  };

  // Map click handler — the map already filters out-of-bounds clicks,
  // but we keep the check here too for safety
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const name = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (clickMode === "origin") {
      setOrigin({ name, lat, lng });
      setOriginName(name);
      setClickMode("destination");
    } else if (clickMode === "destination") {
      setDestination({ name, lat, lng });
      setDestName(name);
      setClickMode(null);
    }
  }, [clickMode]);

  const handleScanArea = async () => {
    if (!neighborhood) return;
    setScanError(null);
    setScanLoading(true);
    setScanResult(null);
    setScanPoints([]);
    try {
      const data = await scanArea({
        center_lat: neighborhood.lat,
        center_lng: neighborhood.lng,
        radius_meters: neighborhood.radius,
        neighborhood_name: neighborhood.name,
      });
      setScanResult(data);
      setScanPoints(data.points);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Tarama başarısız oldu.");
    } finally {
      setScanLoading(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) {
      setError("Lütfen başlangıç ve bitiş noktalarını seçin.");
      return;
    }
    if (!isWithinBounds(origin.lat, origin.lng)) {
      setError(`Başlangıç noktası ${neighborhood?.name ?? 'muhtarlık'} sınırları dışında.`);
      return;
    }
    if (!isWithinBounds(destination.lat, destination.lng)) {
      setError(`Bitiş noktası ${neighborhood?.name ?? 'muhtarlık'} sınırları dışında.`);
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
      if (neighborhood) {
        doc.text(`Muhtarlık: ${neighborhood.name} Mahallesi, ${neighborhood.district}`, 110, 28);
      }

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
          {neighborhood && (
            <>
              <span className="text-white/20">|</span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-white/40">📍</span>
                <span className="text-white/70 font-medium">{neighborhood.name}</span>
                <span className="text-white/30">{neighborhood.district}</span>
              </div>
            </>
          )}
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
                  if (!isWithinBounds(lat, lng)) {
                    showBoundsWarning();
                    return;
                  }
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
                  if (!isWithinBounds(lat, lng)) {
                    showBoundsWarning();
                    return;
                  }
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
              <p className="text-xs text-white/30 mb-1.5">
                {neighborhood ? `${neighborhood.name} hızlı rotalar:` : 'Hızlı seç:'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickFillOptions.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => quickFill(idx)}
                    className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors border border-white/5"
                  >
                    {opt.label}
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

          {/* ── All-roads toggle ─────────────────────────────────────────── */}
          {neighborhood && (
            <div className="px-4 py-3 border-b border-white/5">
              <button
                type="button"
                onClick={() => setShowAllRoads((v) => !v)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  showAllRoads
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>🛣️</span>
                  <span>{showAllRoads ? "Mahalle Yollarını Gizle" : "Tüm Mahalle Yollarını Göster"}</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${showAllRoads ? "bg-amber-400" : "bg-white/20"}`} />
              </button>

              {showAllRoads && (
                <div className="mt-2.5 rounded-lg border border-white/5 bg-white/3 p-2.5">
                  <p className="text-xs text-white/30 mb-1.5 font-medium uppercase tracking-wide">Yol Tipi Lejandı</p>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2">
                    {[
                      { color: "#ef4444", label: "Otoyol" },
                      { color: "#f97316", label: "Çevre Yolu" },
                      { color: "#eab308", label: "Ana Cadde" },
                      { color: "#4ade80", label: "İkincil Yol" },
                      { color: "#34d399", label: "Üçüncül Yol" },
                      { color: "#60a5fa", label: "Sokak" },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className="w-5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-white/50">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Mahalle Taraması ─────────────────────────────────────────── */}
          {neighborhood && (
            <div className="px-4 py-3 border-b border-white/5">
              <button
                type="button"
                onClick={handleScanArea}
                disabled={scanLoading}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  scanLoading
                    ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
                }`}
              >
                <span className="flex items-center gap-2">
                  {scanLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  ) : (
                    <span>🔬</span>
                  )}
                  <span>
                    {scanLoading
                      ? `${neighborhood.name} taranıyor…`
                      : "Tüm Alanı Analiz Et (AI)"}
                  </span>
                </span>
                {!scanLoading && (
                  <span className="text-xs text-white/30">StreetView + AI</span>
                )}
              </button>

              {scanLoading && (
                <div className="mt-2.5 space-y-1.5">
                  <ScanStep label="Grid nokta üretimi" done />
                  <ScanStep label="Street View görüntüleri" active />
                  <ScanStep label="KVKK blur uygulanıyor" />
                  <ScanStep label="HuggingFace AI analizi" />
                  <ScanStep label="Harita güncelleniyor" />
                </div>
              )}

              {scanError && (
                <p className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                  {scanError}
                </p>
              )}

              {scanResult && !scanLoading && (
                <div className="mt-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-300">
                      {scanResult.neighborhood_name} Tarama Sonucu
                    </span>
                    <span className="text-xs text-white/30">
                      {scanResult.summary.scored_points}/{scanResult.summary.total_points} nokta
                    </span>
                  </div>

                  {/* Overall score */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: categoryColor[scanResult.summary.overall_category].hex }}
                    >
                      {scanResult.summary.avg_damage_score.toFixed(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {categoryColor[scanResult.summary.overall_category].label}
                      </p>
                      <p className="text-xs text-white/40">
                        Ortalama hasar: {scanResult.summary.avg_damage_score.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Category breakdown */}
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[
                      { label: "İyi",    count: scanResult.summary.good_count,     color: "#22c55e" },
                      { label: "Orta",   count: scanResult.summary.fair_count,     color: "#eab308" },
                      { label: "Kötü",   count: scanResult.summary.poor_count,     color: "#f97316" },
                      { label: "Kritik", count: scanResult.summary.critical_count, color: "#ef4444" },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="text-center">
                        <div className="text-sm font-bold" style={{ color }}>{count}</div>
                        <div className="text-xs text-white/30">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Worst point callout */}
                  {scanResult.summary.worst_point && (
                    <div className="pt-1 border-t border-white/5">
                      <p className="text-xs text-red-400/80 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>
                          En kötü nokta:{" "}
                          {scanResult.summary.worst_point.lat.toFixed(4)},{" "}
                          {scanResult.summary.worst_point.lng.toFixed(4)} —{" "}
                          {scanResult.summary.worst_point.damage_score.toFixed(0)}% hasar
                        </span>
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => { setScanResult(null); setScanPoints([]); }}
                    className="w-full text-xs text-white/30 hover:text-white/60 transition-colors pt-1"
                  >
                    Tarama sonuçlarını temizle
                  </button>
                </div>
              )}
            </div>
          )}

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
              initialCenter={neighborhood ? { lat: neighborhood.lat, lng: neighborhood.lng } : undefined}
              initialZoom={neighborhood ? 14 : 11}
              neighborhood={
                neighborhood
                  ? { lat: neighborhood.lat, lng: neighborhood.lng, radius: neighborhood.radius, name: neighborhood.name }
                  : undefined
              }
              onOutOfBoundsClick={showBoundsWarning}
              showAllRoads={showAllRoads}
              scanPoints={scanPoints.length > 0 ? scanPoints : undefined}
            />

            {/* Click mode hint overlay */}
            {clickMode && !boundsWarning && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-white/20 rounded-xl px-4 py-2 text-sm text-white pointer-events-none shadow-xl">
                🎯 {clickMode === "origin" ? "Başlangıç noktasını" : "Bitiş noktasını"} haritaya tıklayarak seç
              </div>
            )}

            {/* Out-of-bounds warning toast */}
            {boundsWarning && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-950/95 border border-red-500/50 rounded-xl px-4 py-2.5 text-sm text-red-200 pointer-events-none shadow-xl flex items-center gap-2 animate-pulse">
                <span>🚫</span>
                <span>
                  {neighborhood
                    ? `Bu nokta ${neighborhood.name} sınırları dışında`
                    : 'Bu nokta muhtarlık sınırları dışında'}
                </span>
              </div>
            )}

            {/* No-analysis placeholder (only when no result, no scan, no click mode) */}
            {!result && !scanLoading && scanPoints.length === 0 && !clickMode && !origin && !destination && (
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

function ScanStep({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 h-4 flex-shrink-0 text-center">
        {done ? (
          <span className="text-purple-400 text-xs">✓</span>
        ) : active ? (
          <span className="inline-block w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-white/10 mx-auto mt-1" />
        )}
      </span>
      <span className={`text-xs ${done ? "text-purple-400" : active ? "text-white" : "text-white/30"}`}>
        {label}
      </span>
    </div>
  );
}

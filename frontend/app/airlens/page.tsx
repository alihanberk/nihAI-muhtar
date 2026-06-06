"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useNeighborhood } from "@/contexts/NeighborhoodContext";
import {
  airlensApi,
  AirlensScan,
  ScanReport,
  CoolRoute,
  HEAT_RISK_COLORS,
} from "@/lib/airlens";
import StatsPanel from "@/components/airlens/StatsPanel";

// Mapbox map loaded only in browser
const GreenHeatMap = dynamic(
  () => import("@/components/airlens/GreenHeatMap"),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-900 animate-pulse rounded-xl" /> }
);

type TabType = "green" | "hotspot" | "route";

export default function AirlensPage() {
  const router = useRouter();
  const { neighborhood } = useNeighborhood();

  const [scan, setScan] = useState<AirlensScan | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [coolRoute, setCoolRoute] = useState<CoolRoute | null>(null);

  const [scanning, setScanning] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("green");

  const startScan = useCallback(async () => {
    if (!neighborhood) {
      setError("Önce bir mahalle seçin.");
      return;
    }
    setScanning(true);
    setError(null);
    setScan(null);
    setReport(null);
    setCoolRoute(null);

    try {
      const result = await airlensApi.scanDistrict({
        district_name: `${neighborhood.district} - ${neighborhood.name}`,
        center_lat: neighborhood.lat,
        center_lng: neighborhood.lng,
        radius_meters: neighborhood.radius ?? 1000,
      });
      setScan(result);

      const rep = await airlensApi.getScanReport(result.id);
      setReport(rep);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarama başarısız oldu.");
    } finally {
      setScanning(false);
    }
  }, [neighborhood]);

  const fetchCoolRoute = useCallback(async () => {
    if (!scan) return;
    setRouteLoading(true);
    try {
      const route = await airlensApi.getCoolRoute(scan.id);
      setCoolRoute(route);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rota hesaplanamadı.");
    } finally {
      setRouteLoading(false);
    }
  }, [scan]);

  const cells = scan?.cells ?? [];
  const center = neighborhood
    ? { lat: neighborhood.lat, lng: neighborhood.lng }
    : { lat: 41.0082, lng: 28.9784 };

  const overallRisk = report?.heat_risk;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            ←
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-lg">🌿</span>
            <h1 className="font-bold text-base">AirLens</h1>
            <span className="text-xs text-white/30">Sokak Yeşillik & Isı Haritası</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {neighborhood && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
              <span className="text-xs text-white/50">📍</span>
              <span className="text-xs font-medium">{neighborhood.name}</span>
              <span className="text-xs text-white/30">{neighborhood.district}</span>
            </div>
          )}
          {overallRisk && (
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-bold border"
              style={{
                background: HEAT_RISK_COLORS[overallRisk] + "22",
                color: HEAT_RISK_COLORS[overallRisk],
                borderColor: HEAT_RISK_COLORS[overallRisk] + "44",
              }}
            >
              {overallRisk === "LOW" ? "Düşük Risk"
                : overallRisk === "MODERATE" ? "Orta Risk"
                : overallRisk === "HIGH" ? "Yüksek Risk"
                : "Kritik Risk"}
            </div>
          )}
          <button
            onClick={() => router.push("/select-neighborhood")}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Mahalle Değiştir
          </button>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map panel */}
        <div className="flex-1 relative">
          <GreenHeatMap
            cells={cells}
            coolRoute={activeTab === "route" ? coolRoute : null}
            center={center}
            zoom={14}
          />

          {/* Scan button overlay */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            {error && (
              <div className="bg-red-500/90 text-white text-xs px-4 py-2 rounded-lg max-w-xs text-center">
                {error}
              </div>
            )}
            <button
              onClick={startScan}
              disabled={scanning || !neighborhood}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm shadow-lg transition-all
                bg-green-500 hover:bg-green-400 text-white disabled:opacity-50 disabled:cursor-not-allowed
                disabled:bg-gray-600"
            >
              {scanning ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Taranıyor… (birkaç dakika)
                </>
              ) : (
                <>
                  <span>🔍</span>
                  {scan ? "Yeniden Tara" : "Yeşillik Taraması Başlat"}
                </>
              )}
            </button>
          </div>

          {/* Legend */}
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-xl p-3 text-xs space-y-1.5 border border-white/10">
            <div className="font-semibold text-white/70 mb-2">Yeşillik Skoru</div>
            {[
              { label: "≥ 40%", color: "#1a9850" },
              { label: "25–40%", color: "#91cf60" },
              { label: "15–25%", color: "#fee08b" },
              { label: "8–15%",  color: "#f46d43" },
              { label: "< 8%",   color: "#d73027" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: color }}
                />
                <span className="text-white/60">{label}</span>
              </div>
            ))}
            {cells.length > 0 && (
              <div className="pt-1.5 border-t border-white/10 text-white/40 font-mono">
                {cells.length} hücre
              </div>
            )}
          </div>
        </div>

        {/* Stats side panel */}
        <div className="w-80 border-l border-white/10 bg-gray-900 flex flex-col overflow-hidden shrink-0">
          <StatsPanel
            report={report}
            coolRoute={coolRoute}
            onCoolRouteRequest={fetchCoolRoute}
            coolRouteLoading={routeLoading}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </div>

      {/* ── KVKK footer ──────────────────────────────────────────────────── */}
      <footer className="px-5 py-2 border-t border-white/5 text-center text-xs text-white/20 shrink-0">
        KVKK uyumlu: Yüz/plaka tanımaz · Ham görüntüler işlem sonrası silinir · Yalnızca koordinat + skor saklanır
      </footer>
    </div>
  );
}

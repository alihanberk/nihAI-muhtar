"use client";

import {
  ScanReport,
  GridCell,
  CoolRoute,
  HEAT_RISK_COLORS,
  HEAT_RISK_LABELS,
  greenScoreToColor,
  HeatRiskLevel,
} from "@/lib/airlens";

// ─── Tiny bar ─────────────────────────────────────────────────────────────────
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ─── Heat risk badge ──────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: HeatRiskLevel }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-bold"
      style={{
        background: HEAT_RISK_COLORS[level] + "33",
        color: HEAT_RISK_COLORS[level],
        border: `1px solid ${HEAT_RISK_COLORS[level]}55`,
      }}
    >
      {HEAT_RISK_LABELS[level]}
    </span>
  );
}

// ─── Green score ring ─────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(score / 100, 1) * circ;
  const color = greenScoreToColor(score);
  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <svg className="-rotate-90" width={64} height={64}>
        <circle cx={32} cy={32} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
        <circle
          cx={32} cy={32} r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>
        {score.toFixed(0)}%
      </span>
    </div>
  );
}

// ─── Cell row ─────────────────────────────────────────────────────────────────
function CellRow({ cell, rank }: { cell: GridCell; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/50 font-mono shrink-0">
        {rank}
      </div>
      <ScoreRing score={cell.green_score} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/60 font-mono truncate">
          {cell.lat.toFixed(5)}, {cell.lng.toFixed(5)}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <RiskBadge level={cell.heat_risk} />
          {cell.from_cache && (
            <span className="text-xs text-white/30">önbellek</span>
          )}
        </div>
        <div className="mt-1 grid grid-cols-3 gap-x-3 text-xs text-white/40">
          <span>🌳 {cell.vegetation_pct.toFixed(0)}%</span>
          <span>🏢 {cell.building_pct.toFixed(0)}%</span>
          <span>🛣 {cell.road_pct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Distribution bar chart ───────────────────────────────────────────────────
function DistributionChart({
  distribution,
  total,
}: {
  distribution: Record<string, number>;
  total: number;
}) {
  const levels: HeatRiskLevel[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
  return (
    <div className="space-y-2">
      {levels.map((level) => {
        const count = distribution[level] ?? 0;
        const pct = total > 0 ? ((count / total) * 100).toFixed(0) : "0";
        return (
          <div key={level} className="flex items-center gap-2">
            <div className="w-20 text-xs shrink-0" style={{ color: HEAT_RISK_COLORS[level] }}>
              {HEAT_RISK_LABELS[level]}
            </div>
            <div className="flex-1">
              <Bar value={count} max={total} color={HEAT_RISK_COLORS[level]} />
            </div>
            <div className="text-xs text-white/40 w-12 text-right font-mono">
              {count} ({pct}%)
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Cool route panel ─────────────────────────────────────────────────────────
function CoolRoutePanel({ route }: { route: CoolRoute }) {
  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🌿</span>
        <div>
          <div className="text-sm font-semibold text-green-400">Serin Yürüyüş Rotası</div>
          <div className="text-xs text-white/40">{route.description}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-white/5 p-2">
          <div className="text-lg font-bold text-green-400">
            {(route.total_distance_m / 1000).toFixed(1)} km
          </div>
          <div className="text-xs text-white/40">Mesafe</div>
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <div className="text-lg font-bold text-green-400">{route.waypoints.length}</div>
          <div className="text-xs text-white/40">Durak</div>
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <div className="text-lg font-bold text-green-400">
            {route.avg_green_score.toFixed(0)}%
          </div>
          <div className="text-xs text-white/40">Ort. Yeşillik</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface StatsPanelProps {
  report: ScanReport | null;
  coolRoute: CoolRoute | null;
  onCoolRouteRequest: () => void;
  coolRouteLoading: boolean;
  activeTab: "green" | "hotspot" | "route";
  onTabChange: (tab: "green" | "hotspot" | "route") => void;
}

export default function StatsPanel({
  report,
  coolRoute,
  onCoolRouteRequest,
  coolRouteLoading,
  activeTab,
  onTabChange,
}: StatsPanelProps) {
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3 p-8">
        <span className="text-4xl">🌿</span>
        <p className="text-sm text-center">İlçe seçin ve yeşillik taraması başlatın</p>
      </div>
    );
  }

  const tabs = [
    { id: "green" as const,   label: "🌳 En Yeşil 10" },
    { id: "hotspot" as const, label: "🔥 Kritik 10" },
    { id: "route" as const,   label: "🥾 Serin Rota" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden text-white">
      {/* Summary header */}
      <div className="p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-base">{report.district}</h2>
            <p className="text-xs text-white/40">{report.scored_cells} hücre analiz edildi</p>
          </div>
          <ScoreRing score={report.avg_green} />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-white/50">İlçe ısı riski:</span>
          <RiskBadge level={report.heat_risk} />
          <span className="text-xs text-white/30 ml-auto">
            {(report.duration_ms / 1000).toFixed(1)}s
          </span>
        </div>
        <DistributionChart distribution={report.distribution} total={report.scored_cells} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-white border-b-2 border-green-400"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {activeTab === "green" && (
          <>
            <p className="text-xs text-white/30 mb-3">
              En yüksek yeşillik skoruna sahip 10 nokta
            </p>
            {(report.top_green ?? []).map((cell, i) => (
              <CellRow key={cell.id} cell={cell} rank={i + 1} />
            ))}
          </>
        )}

        {activeTab === "hotspot" && (
          <>
            <p className="text-xs text-white/30 mb-3">
              Acil ağaçlandırma gereken 10 kritik nokta
            </p>
            {(report.hotspots ?? []).map((cell, i) => (
              <CellRow key={cell.id} cell={cell} rank={i + 1} />
            ))}
          </>
        )}

        {activeTab === "route" && (
          <div className="space-y-3">
            <p className="text-xs text-white/30">
              Yeşil sokakları birleştiren en serin yürüyüş rotası
            </p>
            {coolRoute ? (
              <CoolRoutePanel route={coolRoute} />
            ) : (
              <button
                onClick={onCoolRouteRequest}
                disabled={coolRouteLoading}
                className="w-full py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {coolRouteLoading ? "Rota hesaplanıyor…" : "🥾 Serin Rota Bul"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

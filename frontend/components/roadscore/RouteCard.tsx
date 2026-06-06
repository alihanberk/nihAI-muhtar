"use client";

import {
  ScoreRoute,
  categoryColor,
  formatDuration,
  formatDistance,
  routeTypeLabel,
} from "@/lib/roadscore";

interface RouteCardProps {
  route: ScoreRoute;
  isActive: boolean;
  isRecommended: boolean;
  onClick: () => void;
}

const routeTypeIcon: Record<string, string> = {
  fastest:    "⚡",
  healthiest: "🛡",
  balanced:   "⚖",
};

export default function RouteCard({ route, isActive, isRecommended, onClick }: RouteCardProps) {
  const category = getCategoryFromScore(route.damage_score);
  const color = categoryColor[category];

  // Count segments per category
  const counts = { GOOD: 0, FAIR: 0, POOR: 0, CRITICAL: 0 };
  route.segments?.forEach((s) => {
    counts[s.damage_category] = (counts[s.damage_category] ?? 0) + 1;
  });

  return (
    <button
      onClick={onClick}
      className={`
        relative w-full text-left rounded-xl border transition-all duration-200 p-4
        ${isActive
          ? "border-white bg-white/10 shadow-lg shadow-white/10"
          : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/25"
        }
      `}
    >
      {isRecommended && (
        <span className="absolute -top-2.5 left-3 text-xs font-semibold bg-blue-500 text-white px-2 py-0.5 rounded-full">
          Önerilen
        </span>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{routeTypeIcon[route.route_type] ?? "📍"}</span>
          <span className="font-semibold text-white text-sm">
            {routeTypeLabel[route.route_type]}
          </span>
        </div>
        {/* Damage badge */}
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${color.tw}`}
        >
          {color.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatItem label="Süre" value={formatDuration(route.duration_seconds)} />
        <StatItem label="Mesafe" value={formatDistance(route.distance_meters)} />
        <StatItem
          label="Hasar"
          value={`${route.damage_score.toFixed(0)}%`}
          valueClass={`font-bold text-${colorNameFromScore(route.damage_score)}-400`}
        />
      </div>

      {/* Damage distribution bar */}
      <DamageBar counts={counts} total={route.segment_count} />

      {/* Segment count */}
      <p className="text-xs text-white/40 mt-2">
        {route.segment_count} analiz noktası
      </p>
    </button>
  );
}

function StatItem({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-white/50">{label}</span>
      <span className={`text-sm font-medium text-white ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

function DamageBar({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  if (total === 0) return null;

  const segments = [
    { key: "GOOD",     color: "#22c55e" },
    { key: "FAIR",     color: "#eab308" },
    { key: "POOR",     color: "#f97316" },
    { key: "CRITICAL", color: "#ef4444" },
  ] as const;

  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      {segments.map(({ key, color }) => {
        const pct = total > 0 ? ((counts[key] ?? 0) / total) * 100 : 0;
        if (pct === 0) return null;
        return (
          <div
            key={key}
            style={{ width: `${pct}%`, backgroundColor: color }}
            title={`${key}: ${counts[key]}`}
          />
        );
      })}
    </div>
  );
}

function getCategoryFromScore(score: number) {
  if (score < 25) return "GOOD" as const;
  if (score < 50) return "FAIR" as const;
  if (score < 75) return "POOR" as const;
  return "CRITICAL" as const;
}

function colorNameFromScore(score: number): string {
  if (score < 25) return "green";
  if (score < 50) return "yellow";
  if (score < 75) return "orange";
  return "red";
}

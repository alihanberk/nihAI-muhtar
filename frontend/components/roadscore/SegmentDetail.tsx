"use client";

import { useEffect, useRef } from "react";
import { SegmentScore, ScoreRoute, categoryColor, routeTypeLabel } from "@/lib/roadscore";

interface SegmentDetailProps {
  segment: SegmentScore;
  route: ScoreRoute;
  onClose: () => void;
}

export default function SegmentDetail({ segment, route, onClose }: SegmentDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const color = categoryColor[segment.damage_category];

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Street View image URL (unblurred public preview — blur happens on the server before AI)
  const streetViewURL = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${segment.lat},${segment.lng}&heading=${segment.heading}&fov=90&key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-slide-up"
      >
        {/* Street View image */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={streetViewURL}
            alt="Street View"
            className="w-full h-48 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            ✕
          </button>

          {/* Damage badge overlay */}
          <div
            className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-white text-sm font-bold shadow-lg"
            style={{ backgroundColor: color.hex }}
          >
            {color.label} — {segment.damage_score.toFixed(0)}%
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Header */}
          <div>
            <h3 className="text-white font-semibold text-base">Segment Detayı</h3>
            <p className="text-white/50 text-xs mt-0.5">
              Rota: {routeTypeLabel[route.route_type]} &middot; Sıra #{segment.segment_order + 1}
            </p>
          </div>

          {/* Score gauge */}
          <div>
            <div className="flex justify-between text-xs text-white/60 mb-1">
              <span>Yüzey Hasarı</span>
              <span className="font-medium" style={{ color: color.hex }}>
                {segment.damage_score.toFixed(1)} / 100
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${segment.damage_score}%`,
                  backgroundColor: color.hex,
                }}
              />
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetaItem label="Koordinat" value={`${segment.lat.toFixed(5)}, ${segment.lng.toFixed(5)}`} />
            <MetaItem label="Güven Skoru" value={`${(segment.confidence * 100).toFixed(0)}%`} />
            <MetaItem label="Kamera Yönü" value={`${segment.heading.toFixed(0)}°`} />
            <MetaItem label="Cache" value={segment.from_cache ? "Evet" : "Hayır"} />
          </div>

          {/* Category description */}
          <div
            className="rounded-xl p-3 text-sm"
            style={{ backgroundColor: `${color.hex}20`, borderColor: `${color.hex}40`, border: "1px solid" }}
          >
            <p className="font-medium" style={{ color: color.hex }}>{segment.damage_category}</p>
            <p className="text-white/60 text-xs mt-1">{categoryDescription[segment.damage_category]}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <a
              href={`https://www.google.com/maps?q=${segment.lat},${segment.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-colors"
            >
              Google Maps&apos;te Aç
            </a>
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-2.5">
      <p className="text-xs text-white/40 mb-0.5">{label}</p>
      <p className="text-sm text-white font-medium truncate">{value}</p>
    </div>
  );
}

const categoryDescription: Record<string, string> = {
  GOOD:     "Yüzey %0–25 hasarlı. Normal kullanım için uygun, bakım gerektirmiyor.",
  FAIR:     "Yüzey %25–50 hasarlı. Hafif çatlaklar ve aşınma mevcut. Kısa vadeli bakım önerilir.",
  POOR:     "Yüzey %50–75 hasarlı. Belirgin çukurlar ve kırık asfalt. Orta vadeli onarım gerekli.",
  CRITICAL: "Yüzey %75–100 hasarlı. Yapısal bütünlük bozulmuş. Acil müdahale gerekiyor.",
};

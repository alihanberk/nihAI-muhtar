'use client';

import type { FacadeDefect } from '@/types/facadescore';
import { DEFECT_LABELS_TR, DEFECT_ICONS, severityColor } from '@/types/facadescore';

interface DefectOverlayProps {
  defects: FacadeDefect[];
  selectedDefect: FacadeDefect | null;
  imageWidth: number;
  imageHeight: number;
}

export default function DefectOverlay({
  defects,
  selectedDefect,
  imageWidth,
  imageHeight,
}: DefectOverlayProps) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {defects.map(defect => {
        const { xmin, ymin, xmax, ymax } = defect.bounding_box;
        const w = xmax - xmin;
        const h = ymax - ymin;
        const isSelected = selectedDefect?.id === defect.id;
        const color = defect.uncertain ? '#fbbf24' : severityColor(defect.severity);
        const opacity = isSelected ? 1 : 0.65;
        const strokeWidth = isSelected ? 3 : 1.5;

        return (
          <g key={defect.id} opacity={opacity} filter={isSelected ? 'url(#glow)' : undefined}>
            {/* Bounding box rectangle */}
            <rect
              x={xmin}
              y={ymin}
              width={w}
              height={h}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={defect.uncertain ? '6 3' : 'none'}
              rx={3}
            />

            {/* Corner accents for selected state */}
            {isSelected && (
              <>
                <line x1={xmin} y1={ymin} x2={xmin + 12} y2={ymin} stroke={color} strokeWidth={3} />
                <line x1={xmin} y1={ymin} x2={xmin} y2={ymin + 12} stroke={color} strokeWidth={3} />
                <line x1={xmax - 12} y1={ymin} x2={xmax} y2={ymin} stroke={color} strokeWidth={3} />
                <line x1={xmax} y1={ymin} x2={xmax} y2={ymin + 12} stroke={color} strokeWidth={3} />
                <line x1={xmin} y1={ymax - 12} x2={xmin} y2={ymax} stroke={color} strokeWidth={3} />
                <line x1={xmin} y1={ymax} x2={xmin + 12} y2={ymax} stroke={color} strokeWidth={3} />
                <line x1={xmax - 12} y1={ymax} x2={xmax} y2={ymax} stroke={color} strokeWidth={3} />
                <line x1={xmax} y1={ymax - 12} x2={xmax} y2={ymax} stroke={color} strokeWidth={3} />
              </>
            )}

            {/* Label pill */}
            <rect
              x={xmin}
              y={Math.max(0, ymin - 22)}
              width={Math.min(w, 160)}
              height={20}
              fill={color}
              fillOpacity={0.9}
              rx={3}
            />
            <text
              x={xmin + 4}
              y={Math.max(0, ymin - 22) + 13}
              fontSize={10}
              fill="white"
              fontFamily="sans-serif"
              fontWeight="600"
            >
              {DEFECT_ICONS[defect.defect_type]} {DEFECT_LABELS_TR[defect.defect_type]}
            </text>

            {/* Confidence badge */}
            <text
              x={xmax - 2}
              y={ymax + 13}
              fontSize={9}
              fill={color}
              fontFamily="sans-serif"
              textAnchor="end"
            >
              {(defect.confidence * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

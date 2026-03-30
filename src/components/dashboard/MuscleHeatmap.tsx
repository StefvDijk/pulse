'use client'

import { useState } from 'react'

export interface MuscleHeatmapProps {
  muscleLoad: Record<string, number>
}

interface MuscleRegion {
  id: string
  label: string
  /** SVG path or ellipse data */
  shape: 'ellipse' | 'path'
  // ellipse params
  cx?: number
  cy?: number
  rx?: number
  ry?: number
  // path params
  d?: string
}

const FRONT_REGIONS: MuscleRegion[] = [
  { id: 'chest', label: 'Borst', shape: 'ellipse', cx: 100, cy: 82, rx: 28, ry: 18 },
  { id: 'shoulders', label: 'Schouders', shape: 'ellipse', cx: 60, cy: 68, rx: 14, ry: 12 },
  { id: 'shoulders_r', label: 'Schouders', shape: 'ellipse', cx: 140, cy: 68, rx: 14, ry: 12 },
  { id: 'biceps', label: 'Biceps', shape: 'ellipse', cx: 48, cy: 95, rx: 9, ry: 16 },
  { id: 'biceps_r', label: 'Biceps', shape: 'ellipse', cx: 152, cy: 95, rx: 9, ry: 16 },
  { id: 'core', label: 'Core', shape: 'ellipse', cx: 100, cy: 115, rx: 20, ry: 20 },
  { id: 'quads', label: 'Quads', shape: 'ellipse', cx: 83, cy: 168, rx: 16, ry: 28 },
  { id: 'quads_r', label: 'Quads', shape: 'ellipse', cx: 117, cy: 168, rx: 16, ry: 28 },
  { id: 'calves', label: 'Kuiten', shape: 'ellipse', cx: 83, cy: 230, rx: 10, ry: 18 },
  { id: 'calves_r', label: 'Kuiten', shape: 'ellipse', cx: 117, cy: 230, rx: 10, ry: 18 },
]

const BACK_REGIONS: MuscleRegion[] = [
  { id: 'upper_back', label: 'Bovenrug', shape: 'ellipse', cx: 100, cy: 82, rx: 28, ry: 18 },
  { id: 'lats', label: 'Lats', shape: 'ellipse', cx: 75, cy: 105, rx: 14, ry: 22 },
  { id: 'lats_r', label: 'Lats', shape: 'ellipse', cx: 125, cy: 105, rx: 14, ry: 22 },
  { id: 'triceps', label: 'Triceps', shape: 'ellipse', cx: 48, cy: 95, rx: 9, ry: 16 },
  { id: 'triceps_r', label: 'Triceps', shape: 'ellipse', cx: 152, cy: 95, rx: 9, ry: 16 },
  { id: 'glutes', label: 'Billen', shape: 'ellipse', cx: 100, cy: 148, rx: 28, ry: 18 },
  { id: 'hamstrings', label: 'Hamstrings', shape: 'ellipse', cx: 83, cy: 185, rx: 15, ry: 26 },
  { id: 'hamstrings_r', label: 'Hamstrings', shape: 'ellipse', cx: 117, cy: 185, rx: 15, ry: 26 },
  { id: 'rotator_cuff', label: 'Rotator cuff', shape: 'ellipse', cx: 58, cy: 75, rx: 10, ry: 8 },
  { id: 'rotator_cuff_r', label: 'Rotator cuff', shape: 'ellipse', cx: 142, cy: 75, rx: 10, ry: 8 },
]

/** Map muscle load (0-100) to a fill color. */
function loadToColor(load: number): string {
  if (load <= 0) return 'transparent'
  if (load <= 33) return '#4f8cff'
  if (load <= 66) return '#f59e0b'
  return '#ef4444'
}

/** Get the canonical muscle key (strip _r suffix for mirrored regions). */
function getMuscleKey(id: string): string {
  return id.replace(/_r$/, '')
}

interface TooltipState {
  label: string
  load: number
  x: number
  y: number
}

function BodySilhouette({
  regions,
  muscleLoad,
  onRegionHover,
  onRegionLeave,
}: {
  regions: MuscleRegion[]
  muscleLoad: Record<string, number>
  onRegionHover: (tooltip: TooltipState) => void
  onRegionLeave: () => void
}) {
  return (
    <>
      {/* Simple body outline */}
      {/* Head */}
      <ellipse cx={100} cy={32} rx={18} ry={22} fill="#1a1a2e" stroke="#3a3a5c" strokeWidth={1.5} />
      {/* Neck */}
      <rect x={91} y={52} width={18} height={10} fill="#1a1a2e" />
      {/* Torso */}
      <path
        d="M 65 62 L 135 62 L 128 145 L 72 145 Z"
        fill="#12121a"
        stroke="#3a3a5c"
        strokeWidth={1.5}
      />
      {/* Left arm */}
      <path
        d="M 65 62 L 40 68 L 36 130 L 52 130 L 55 68 L 68 70 Z"
        fill="#12121a"
        stroke="#3a3a5c"
        strokeWidth={1.5}
      />
      {/* Right arm */}
      <path
        d="M 135 62 L 160 68 L 164 130 L 148 130 L 145 68 L 132 70 Z"
        fill="#12121a"
        stroke="#3a3a5c"
        strokeWidth={1.5}
      />
      {/* Left leg */}
      <path
        d="M 72 145 L 68 200 L 74 255 L 93 255 L 96 200 L 95 145 Z"
        fill="#12121a"
        stroke="#3a3a5c"
        strokeWidth={1.5}
      />
      {/* Right leg */}
      <path
        d="M 105 145 L 104 200 L 107 255 L 126 255 L 132 200 L 128 145 Z"
        fill="#12121a"
        stroke="#3a3a5c"
        strokeWidth={1.5}
      />

      {/* Muscle regions */}
      {regions.map((region) => {
        const key = getMuscleKey(region.id)
        const load = muscleLoad[key] ?? 0
        const fill = loadToColor(load)
        const opacity = load > 0 ? 0.7 : 0

        return (
          <ellipse
            key={region.id}
            cx={region.cx}
            cy={region.cy}
            rx={region.rx}
            ry={region.ry}
            fill={fill}
            opacity={opacity}
            style={{ cursor: load > 0 ? 'pointer' : 'default' }}
            onMouseEnter={(e) => {
              if (load > 0) {
                const svgRect = (e.target as SVGElement)
                  .closest('svg')!
                  .getBoundingClientRect()
                onRegionHover({
                  label: region.label,
                  load,
                  x: e.clientX - svgRect.left,
                  y: e.clientY - svgRect.top,
                })
              }
            }}
            onMouseLeave={onRegionLeave}
          />
        )
      })}
    </>
  )
}

export function MuscleHeatmap({ muscleLoad }: MuscleHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  return (
    <div className="relative">
      <div className="flex gap-4">
        {/* Front */}
        <div className="flex-1">
          <p className="mb-1 text-center text-xs" style={{ color: '#8888a0' }}>
            Voorkant
          </p>
          <svg
            viewBox="0 0 200 270"
            className="w-full"
            onMouseLeave={() => setTooltip(null)}
          >
            <BodySilhouette
              regions={FRONT_REGIONS}
              muscleLoad={muscleLoad}
              onRegionHover={setTooltip}
              onRegionLeave={() => setTooltip(null)}
            />
          </svg>
        </div>

        {/* Back */}
        <div className="flex-1">
          <p className="mb-1 text-center text-xs" style={{ color: '#8888a0' }}>
            Achterkant
          </p>
          <svg
            viewBox="0 0 200 270"
            className="w-full"
            onMouseLeave={() => setTooltip(null)}
          >
            <BodySilhouette
              regions={BACK_REGIONS}
              muscleLoad={muscleLoad}
              onRegionHover={setTooltip}
              onRegionLeave={() => setTooltip(null)}
            />
          </svg>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded px-2 py-1 text-xs shadow"
          style={{
            left: tooltip.x + 8,
            top: tooltip.y - 28,
            backgroundColor: '#1a1a2e',
            border: '1px solid #3a3a5c',
            color: '#f0f0f5',
          }}
        >
          {tooltip.label}: {Math.round(tooltip.load)}%
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-3 text-xs" style={{ color: '#8888a0' }}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded" style={{ backgroundColor: '#4f8cff' }} />
          Licht
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded" style={{ backgroundColor: '#f59e0b' }} />
          Matig
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded" style={{ backgroundColor: '#ef4444' }} />
          Zwaar
        </span>
      </div>
    </div>
  )
}

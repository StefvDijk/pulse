'use client'

import { useMemo, useState } from 'react'
import {
  BACK,
  BACK_VIEWBOX,
  DECORATIVE_SLUGS,
  FRONT,
  FRONT_VIEWBOX,
  OUTLINE_BACK,
  OUTLINE_FRONT,
  type BodyMuscle,
} from '@/lib/body-map/data'
import { getMuscleLabel } from '@/components/home/MuscleGroupDot'

/* ── Props ──────────────────────────────────────────────────── */

export interface MuscleHeatmapProps {
  /**
   * Hits per DB muscle group (from `computeVolume` in `@/lib/muscle-map/volume`).
   * Primary = 1 hit per set, secondary = 0.5 per set.
   */
  volume: Record<string, number>
  /** Called when the user clicks a muscle that has volume > 0. */
  onMuscleClick?: (muscleGroup: string) => void
}

/* ── DB muscle → SVG slug mapping ───────────────────────────── */

/**
 * Which SVG body slugs should light up for a given DB muscle group.
 * Slugs come from the extracted `FRONT` / `BACK` arrays.
 *
 * Notes:
 * - `lats` and `upper_back` both live on the `upper-back` SVG path; counts merge.
 * - `hip_flexors` and `rotator_cuff` have no natural home — they're tracked in
 *   the legend but don't tint the body.
 */
const DB_TO_SVG_SLUGS: Record<string, string[]> = {
  chest: ['chest'],
  upper_back: ['upper-back'],
  lats: ['upper-back'],
  shoulders: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves', 'tibialis'],
  core: ['abs', 'obliques'],
}

/** Inverse: SVG slug → DB muscles that contribute to its tint. */
const SVG_SLUG_TO_DB: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {}
  for (const [db, slugs] of Object.entries(DB_TO_SVG_SLUGS)) {
    for (const slug of slugs) {
      if (!out[slug]) out[slug] = []
      out[slug].push(db)
    }
  }
  return out
})()

/* ── Heatmap tiers (design-system thresholds, Apple HIG palette) ── */

interface Tier {
  maxSets: number
  fill: string
  opacity: number
}

const TIERS: Tier[] = [
  { maxSets: 4, fill: 'var(--color-system-orange)', opacity: 0.35 },
  { maxSets: 9, fill: 'var(--color-system-orange)', opacity: 0.55 },
  { maxSets: 14, fill: 'var(--color-system-orange)', opacity: 0.8 },
  { maxSets: Number.POSITIVE_INFINITY, fill: 'var(--color-system-red)', opacity: 0.9 },
]

function tierFor(hits: number): Tier | null {
  if (hits <= 0) return null
  return TIERS.find((t) => hits <= t.maxSets) ?? TIERS[TIERS.length - 1]!
}

/* ── Part rendering ─────────────────────────────────────────── */

interface PartRender {
  totalHits: number
  dominantMuscle: string | null
  tier: Tier | null
  paths: string[]
}

/** For a given SVG muscle part, compute its total hits and which DB muscle dominates. */
function computePart(part: BodyMuscle, volume: Record<string, number>): PartRender {
  const paths = [...(part.left ?? []), ...(part.right ?? [])]

  if (DECORATIVE_SLUGS.has(part.slug)) {
    return { totalHits: 0, dominantMuscle: null, tier: null, paths }
  }

  const contributingDbMuscles = SVG_SLUG_TO_DB[part.slug] ?? []
  let totalHits = 0
  let dominantMuscle: string | null = null
  let dominantHits = 0
  for (const db of contributingDbMuscles) {
    const hits = volume[db] ?? 0
    totalHits += hits
    if (hits > dominantHits) {
      dominantHits = hits
      dominantMuscle = db
    }
  }

  return {
    totalHits,
    dominantMuscle,
    tier: tierFor(totalHits),
    paths,
  }
}

/* ── BodySvg sub-component ──────────────────────────────────── */

interface BodySvgProps {
  parts: BodyMuscle[]
  outline: string
  viewBox: string
  volume: Record<string, number>
  hoveredMuscle: string | null
  onHover: (muscleGroup: string | null) => void
  onClick: (muscleGroup: string) => void
}

function BodySvg({
  parts,
  outline,
  viewBox,
  volume,
  hoveredMuscle,
  onHover,
  onClick,
}: BodySvgProps) {
  return (
    <svg
      viewBox={viewBox}
      className="block h-auto w-full max-w-[170px]"
      role="img"
      aria-label="Spierkaart"
    >
      <path
        d={outline}
        fill="none"
        stroke="var(--color-separator-opaque)"
        strokeWidth={2}
        strokeLinecap="butt"
      />
      {parts.map((part, partIdx) => {
        const { tier, paths, dominantMuscle } = computePart(part, volume)
        const isDecorative = DECORATIVE_SLUGS.has(part.slug)
        const isActive = !isDecorative && tier !== null
        const isHovered =
          !isDecorative && dominantMuscle !== null && hoveredMuscle === dominantMuscle

        const fill = isDecorative
          ? 'var(--color-system-gray4)'
          : tier
            ? tier.fill
            : 'var(--color-system-gray5)'
        const fillOpacity = isDecorative ? 0.55 : (tier?.opacity ?? 0.55)
        const stroke = isHovered
          ? 'var(--color-system-orange)'
          : isActive
            ? 'rgba(255, 149, 0, 0.25)'
            : 'var(--color-separator)'
        const strokeWidth = isHovered ? 1.5 : 0.4
        const cursor = isActive ? 'pointer' : 'default'

        return paths.map((d, pathIdx) => (
          <path
            key={`${partIdx}-${pathIdx}`}
            d={d}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            style={{
              cursor,
              transition: 'fill-opacity 0.2s, stroke 0.2s, stroke-width 0.2s',
            }}
            onMouseEnter={isActive && dominantMuscle ? () => onHover(dominantMuscle) : undefined}
            onMouseLeave={isActive ? () => onHover(null) : undefined}
            onClick={isActive && dominantMuscle ? () => onClick(dominantMuscle) : undefined}
            onTouchStart={
              isActive && dominantMuscle
                ? (e) => {
                    e.preventDefault()
                    onHover(dominantMuscle)
                  }
                : undefined
            }
          />
        ))
      })}
    </svg>
  )
}

/* ── Main component ─────────────────────────────────────────── */

export function MuscleHeatmap({ volume, onMuscleClick }: MuscleHeatmapProps) {
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null)

  const hoveredHits = useMemo(() => {
    if (!hoveredMuscle) return 0
    // Include any muscles that merge into the hovered one via DB_TO_SVG_SLUGS.
    const slugs = DB_TO_SVG_SLUGS[hoveredMuscle] ?? []
    const peers = new Set<string>([hoveredMuscle])
    for (const slug of slugs) {
      for (const peer of SVG_SLUG_TO_DB[slug] ?? []) {
        peers.add(peer)
      }
    }
    let sum = 0
    for (const peer of peers) sum += volume[peer] ?? 0
    return sum
  }, [hoveredMuscle, volume])

  const handleClick = (muscleGroup: string) => {
    if (!onMuscleClick) return
    if ((volume[muscleGroup] ?? 0) <= 0) return
    onMuscleClick(muscleGroup)
  }

  return (
    <div className="relative">
      {/* Tooltip bar — fixed-height so the body doesn't jump when hovering */}
      <div className="mb-1 flex h-7 items-center justify-center">
        {hoveredMuscle && hoveredHits > 0 ? (
          <div className="text-label-primary rounded-full bg-system-gray6 px-3 py-1 text-caption1 font-medium">
            {getMuscleLabel(hoveredMuscle)} · {Math.round(hoveredHits)} hits
          </div>
        ) : null}
      </div>

      <div
        className="flex justify-center gap-2"
        onMouseLeave={() => setHoveredMuscle(null)}
        onTouchEnd={() => {
          // Clear hover after a short delay on touch so the tooltip is readable
          window.setTimeout(() => setHoveredMuscle(null), 1800)
        }}
      >
        <div className="flex flex-1 flex-col items-center">
          <BodySvg
            parts={FRONT}
            outline={OUTLINE_FRONT}
            viewBox={FRONT_VIEWBOX}
            volume={volume}
            hoveredMuscle={hoveredMuscle}
            onHover={setHoveredMuscle}
            onClick={handleClick}
          />
          <span className="text-label-tertiary mt-1 text-caption2 uppercase tracking-[0.2em]">
            Voor
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center">
          <BodySvg
            parts={BACK}
            outline={OUTLINE_BACK}
            viewBox={BACK_VIEWBOX}
            volume={volume}
            hoveredMuscle={hoveredMuscle}
            onHover={setHoveredMuscle}
            onClick={handleClick}
          />
          <span className="text-label-tertiary mt-1 text-caption2 uppercase tracking-[0.2em]">
            Achter
          </span>
        </div>
      </div>
    </div>
  )
}

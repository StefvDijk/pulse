'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  appleTooltipItemStyle,
  appleTooltipStyle,
  macroColors,
} from '@/lib/chart-styles'
import { useMotionEnabled } from '@/hooks/useReducedMotion'

export interface MacroSummaryProps {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

const SEGMENTS = [
  { key: 'protein_g', label: 'Eiwit', color: macroColors.protein },
  { key: 'carbs_g', label: 'Koolh.', color: macroColors.carbs },
  { key: 'fat_g', label: 'Vet', color: macroColors.fat },
] as const

export function MacroSummary({ calories, protein_g, carbs_g, fat_g, fiber_g }: MacroSummaryProps) {
  const animated = useMotionEnabled()
  const data = [
    { name: 'Eiwit', value: protein_g, color: macroColors.protein },
    { name: 'Koolhydraten', value: carbs_g, color: macroColors.carbs },
    { name: 'Vet', value: fat_g, color: macroColors.fat },
  ].filter((d) => d.value > 0)

  const hasData = data.length > 0

  return (
    <div className="flex items-center gap-4">
      {/* Donut chart */}
      <div className="relative h-28 w-28 shrink-0">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius={50}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
                isAnimationActive={animated}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={appleTooltipStyle}
                itemStyle={appleTooltipItemStyle}
                formatter={(value) => [`${Math.round(Number(value))}g`]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white/[0.06]" />
        )}
        {/* Calories in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-title3 font-bold leading-none text-text-primary tabular-nums">
            {calories}
          </span>
          <span className="text-caption1 text-text-tertiary">
            kcal
          </span>
        </div>
      </div>

      {/* Macro details */}
      <div className="flex flex-col gap-2">
        {SEGMENTS.map(({ key, label, color }) => {
          const val = key === 'protein_g' ? protein_g : key === 'carbs_g' ? carbs_g : fat_g
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-caption1 text-text-tertiary">
                {label}
              </span>
              <span className="text-caption1 font-semibold text-text-primary tabular-nums">
                {Math.round(val)}g
              </span>
            </div>
          )
        })}
        {fiber_g > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: macroColors.fiber }} />
            <span className="text-caption1 text-text-tertiary">
              Vezels
            </span>
            <span className="text-caption1 font-semibold text-text-primary tabular-nums">
              {Math.round(fiber_g)}g
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

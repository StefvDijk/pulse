'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export interface MacroSummaryProps {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

const SEGMENTS = [
  { key: 'protein_g', label: 'Eiwit', color: '#2E6F6F' },
  { key: 'carbs_g', label: 'Koolh.', color: '#B45309' },
  { key: 'fat_g', label: 'Vet', color: '#C2410C' },
] as const

export function MacroSummary({ calories, protein_g, carbs_g, fat_g, fiber_g }: MacroSummaryProps) {
  const data = [
    { name: 'Eiwit', value: protein_g, color: '#2E6F6F' },
    { name: 'Koolhydraten', value: carbs_g, color: '#B45309' },
    { name: 'Vet', value: fat_g, color: '#C2410C' },
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
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#FDFCFA', border: '1px solid #E7E5E0', borderRadius: '8px' }}
                itemStyle={{ color: '#1C1917', fontSize: '12px' }}
                formatter={(value) => [`${Math.round(Number(value))}g`]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-bg-subtle" />
        )}
        {/* Calories in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none text-text-primary">
            {calories}
          </span>
          <span className="text-xs text-text-tertiary">
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
              <span className="text-xs text-text-tertiary">
                {label}
              </span>
              <span className="text-xs font-medium text-text-primary">
                {Math.round(val)}g
              </span>
            </div>
          )
        })}
        {fiber_g > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: '#16A34A' }} />
            <span className="text-xs text-text-tertiary">
              Vezels
            </span>
            <span className="text-xs font-medium text-text-primary">
              {Math.round(fiber_g)}g
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

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
  { key: 'protein_g', label: 'Eiwit', color: '#4f8cff' },
  { key: 'carbs_g', label: 'Koolh.', color: '#f59e0b' },
  { key: 'fat_g', label: 'Vet', color: '#8b5cf6' },
] as const

export function MacroSummary({ calories, protein_g, carbs_g, fat_g, fiber_g }: MacroSummaryProps) {
  const data = [
    { name: 'Eiwit', value: protein_g, color: '#4f8cff' },
    { name: 'Koolhydraten', value: carbs_g, color: '#f59e0b' },
    { name: 'Vet', value: fat_g, color: '#8b5cf6' },
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
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: '8px' }}
                itemStyle={{ color: '#f0f0f5', fontSize: '12px' }}
                formatter={(value) => [`${Math.round(Number(value))}g`]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{ backgroundColor: '#1a1a2e' }}
          />
        )}
        {/* Calories in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none" style={{ color: '#f0f0f5' }}>
            {calories}
          </span>
          <span className="text-xs" style={{ color: '#8888a0' }}>
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
              <span className="text-xs" style={{ color: '#8888a0' }}>
                {label}
              </span>
              <span className="text-xs font-medium" style={{ color: '#f0f0f5' }}>
                {Math.round(val)}g
              </span>
            </div>
          )
        })}
        {fiber_g > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: '#22c55e' }} />
            <span className="text-xs" style={{ color: '#8888a0' }}>
              Vezels
            </span>
            <span className="text-xs font-medium" style={{ color: '#f0f0f5' }}>
              {Math.round(fiber_g)}g
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

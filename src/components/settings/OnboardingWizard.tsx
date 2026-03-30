'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface WizardStep {
  title: string
  description: string
}

const STEPS: WizardStep[] = [
  { title: 'Profiel', description: 'Vertel ons iets over jezelf' },
  { title: 'Sporten', description: 'Hoeveel wil je trainen?' },
  { title: 'Koppelingen', description: 'Verbind je data bronnen' },
  { title: 'Doelen', description: 'Wat wil je bereiken?' },
]

interface ProfileData {
  displayName: string
  weightKg: string
  heightCm: string
}

interface SportData {
  gym: string
  running: string
  padel: string
}

interface ConnectionData {
  hevyKey: string
  healthToken: string
}

interface GoalData {
  title: string
  category: string
  targetValue: string
  targetUnit: string
}

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [profile, setProfile] = useState<ProfileData>({ displayName: '', weightKg: '', heightCm: '' })
  const [sports, setSports] = useState<SportData>({ gym: '3', running: '2', padel: '1' })
  const [connections, setConnections] = useState<ConnectionData>({ hevyKey: '', healthToken: '' })
  const [goals, setGoals] = useState<GoalData[]>([{ title: '', category: 'strength', targetValue: '', targetUnit: '' }])

  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  function addGoal() {
    if (goals.length >= 3) return
    setGoals((prev) => [...prev, { title: '', category: 'strength', targetValue: '', targetUnit: '' }])
  }

  function updateGoal(index: number, field: keyof GoalData, value: string) {
    setGoals((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)))
  }

  function removeGoal(index: number) {
    setGoals((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleFinish() {
    setSaving(true)
    try {
      // Save profile + settings
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            display_name: profile.displayName.trim() || 'Gebruiker',
            weight_kg: profile.weightKg ? Number(profile.weightKg) : null,
            height_cm: profile.heightCm ? Number(profile.heightCm) : null,
          },
          settings: {
            hevy_api_key: connections.hevyKey || null,
            health_auto_export_token: connections.healthToken || null,
            weekly_training_target: {
              gym: Number(sports.gym) || 0,
              running: Number(sports.running) || 0,
              padel: Number(sports.padel) || 0,
            },
          },
        }),
      })

      // Save goals (only ones with a title)
      const validGoals = goals.filter((g) => g.title.trim())
      for (const goal of validGoals) {
        await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: goal.title.trim(),
            category: goal.category,
            target_value: goal.targetValue ? Number(goal.targetValue) : null,
            target_unit: goal.targetUnit || null,
            target_type: 'max',
          }),
        })
      }

      router.push('/')
    } catch {
      setSaving(false)
    }
  }

  const INPUT_STYLE = {
    backgroundColor: '#0a0a0f',
    border: '1px solid #1a1a2e',
    color: '#f0f0f5',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e' }}>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: i === step ? '#4f8cff' : i < step ? '#22c55e' : '#1a1a2e',
                  color: i <= step ? '#fff' : '#8888a0',
                }}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className="hidden text-[10px] sm:block" style={{ color: i === step ? '#f0f0f5' : '#8888a0' }}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold" style={{ color: '#f0f0f5' }}>{STEPS[step].title}</h2>
          <p className="text-sm" style={{ color: '#8888a0' }}>{STEPS[step].description}</p>
        </div>

        {/* Step content */}
        <div className="mb-6 flex flex-col gap-4">

          {step === 0 && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Naam</label>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="Jouw naam"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={INPUT_STYLE}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Gewicht (kg)</label>
                  <input
                    type="number"
                    value={profile.weightKg}
                    onChange={(e) => setProfile((p) => ({ ...p, weightKg: e.target.value }))}
                    placeholder="75"
                    min={20}
                    max={300}
                    className="rounded-lg px-3 py-2 text-sm outline-none"
                    style={INPUT_STYLE}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Lengte (cm)</label>
                  <input
                    type="number"
                    value={profile.heightCm}
                    onChange={(e) => setProfile((p) => ({ ...p, heightCm: e.target.value }))}
                    placeholder="175"
                    min={100}
                    max={250}
                    className="rounded-lg px-3 py-2 text-sm outline-none"
                    style={INPUT_STYLE}
                  />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-xs" style={{ color: '#8888a0' }}>Doel aantal sessies per week</p>
              {([['gym', 'Gym', sports.gym], ['running', 'Hardlopen', sports.running], ['padel', 'Padel', sports.padel]] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#f0f0f5' }}>{label}</span>
                  <input
                    type="number"
                    value={sports[key]}
                    onChange={(e) => setSports((s) => ({ ...s, [key]: e.target.value }))}
                    min={0}
                    max={14}
                    className="w-16 rounded-lg px-3 py-1.5 text-sm outline-none text-center"
                    style={INPUT_STYLE}
                  />
                </div>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Hevy API key</label>
                <input
                  type="password"
                  value={connections.hevyKey}
                  onChange={(e) => setConnections((c) => ({ ...c, hevyKey: e.target.value }))}
                  placeholder="Optioneel — voor workout sync"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={INPUT_STYLE}
                />
                <p className="text-xs" style={{ color: '#8888a0' }}>Vind je API key in Hevy → Instellingen → API</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Health Auto Export token</label>
                <input
                  type="password"
                  value={connections.healthToken}
                  onChange={(e) => setConnections((c) => ({ ...c, healthToken: e.target.value }))}
                  placeholder="Optioneel — voor Apple Health sync"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={INPUT_STYLE}
                />
              </div>
              <p className="text-xs" style={{ color: '#8888a0' }}>Je kunt deze later toevoegen via Instellingen.</p>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs" style={{ color: '#8888a0' }}>Voeg maximaal 3 doelen toe (optioneel)</p>
              {goals.map((goal, i) => (
                <div key={i} className="rounded-lg p-3" style={{ backgroundColor: '#0a0a0f', border: '1px solid #1a1a2e' }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: '#8888a0' }}>Doel {i + 1}</span>
                    {goals.length > 1 && (
                      <button onClick={() => removeGoal(i)} className="text-xs" style={{ color: '#ef4444' }}>Verwijder</button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={goal.title}
                      onChange={(e) => updateGoal(i, 'title', e.target.value)}
                      placeholder="Bijv. Bench press 100kg"
                      className="rounded-lg px-3 py-1.5 text-sm outline-none"
                      style={INPUT_STYLE}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={goal.category}
                        onChange={(e) => updateGoal(i, 'category', e.target.value)}
                        className="rounded-lg px-2 py-1.5 text-xs outline-none"
                        style={INPUT_STYLE}
                      >
                        <option value="strength">Kracht</option>
                        <option value="running">Hardlopen</option>
                        <option value="padel">Padel</option>
                        <option value="nutrition">Voeding</option>
                        <option value="general">Algemeen</option>
                      </select>
                      <input
                        type="number"
                        value={goal.targetValue}
                        onChange={(e) => updateGoal(i, 'targetValue', e.target.value)}
                        placeholder="100"
                        min={0}
                        step="any"
                        className="rounded-lg px-2 py-1.5 text-xs outline-none"
                        style={INPUT_STYLE}
                      />
                      <input
                        type="text"
                        value={goal.targetUnit}
                        onChange={(e) => updateGoal(i, 'targetUnit', e.target.value)}
                        placeholder="kg, km…"
                        className="rounded-lg px-2 py-1.5 text-xs outline-none"
                        style={INPUT_STYLE}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {goals.length < 3 && (
                <button
                  onClick={addGoal}
                  className="text-sm"
                  style={{ color: '#4f8cff' }}
                >
                  + Nog een doel toevoegen
                </button>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-sm"
            style={{ color: '#8888a0' }}
          >
            Overslaan
          </button>

          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: '#1a1a2e', color: '#f0f0f5' }}
              >
                Vorige
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#4f8cff', color: '#fff' }}
              >
                {saving ? 'Opslaan…' : 'Klaar'}
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: '#4f8cff', color: '#fff' }}
              >
                Volgende
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

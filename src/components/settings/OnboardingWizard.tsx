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

const INPUT_CLASSES = 'bg-white/[0.06] border border-bg-border text-text-primary rounded-[10px] px-3 py-2 text-sm outline-none'

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 bg-bg-surface border border-bg-border">

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i === step
                    ? 'bg-[#0A84FF] text-white'
                    : i < step
                      ? 'bg-[var(--color-status-good)] text-white'
                      : 'bg-white/[0.06] text-text-tertiary'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`hidden text-[10px] sm:block ${i === step ? 'text-text-primary' : 'text-text-tertiary'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-text-primary">{STEPS[step].title}</h2>
          <p className="text-sm text-text-tertiary">{STEPS[step].description}</p>
        </div>

        {/* Step content */}
        <div className="mb-6 flex flex-col gap-4">

          {step === 0 && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-tertiary">Naam</label>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="Jouw naam"
                  className={INPUT_CLASSES}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-text-tertiary">Gewicht (kg)</label>
                  <input
                    type="number"
                    value={profile.weightKg}
                    onChange={(e) => setProfile((p) => ({ ...p, weightKg: e.target.value }))}
                    placeholder="75"
                    min={20}
                    max={300}
                    className={INPUT_CLASSES}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-text-tertiary">Lengte (cm)</label>
                  <input
                    type="number"
                    value={profile.heightCm}
                    onChange={(e) => setProfile((p) => ({ ...p, heightCm: e.target.value }))}
                    placeholder="175"
                    min={100}
                    max={250}
                    className={INPUT_CLASSES}
                  />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-xs text-text-tertiary">Doel aantal sessies per week</p>
              {([['gym', 'Gym', sports.gym], ['running', 'Hardlopen', sports.running], ['padel', 'Padel', sports.padel]] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">{label}</span>
                  <input
                    type="number"
                    value={sports[key]}
                    onChange={(e) => setSports((s) => ({ ...s, [key]: e.target.value }))}
                    min={0}
                    max={14}
                    className={`w-16 text-center ${INPUT_CLASSES}`}
                  />
                </div>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-tertiary">Hevy API key</label>
                <input
                  type="password"
                  value={connections.hevyKey}
                  onChange={(e) => setConnections((c) => ({ ...c, hevyKey: e.target.value }))}
                  placeholder="Optioneel — voor workout sync"
                  className={INPUT_CLASSES}
                />
                <p className="text-xs text-text-tertiary">Vind je API key in Hevy → Instellingen → API</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-tertiary">Health Auto Export token</label>
                <input
                  type="password"
                  value={connections.healthToken}
                  onChange={(e) => setConnections((c) => ({ ...c, healthToken: e.target.value }))}
                  placeholder="Optioneel — voor Apple Health sync"
                  className={INPUT_CLASSES}
                />
              </div>
              <p className="text-xs text-text-tertiary">Je kunt deze later toevoegen via Instellingen.</p>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs text-text-tertiary">Voeg maximaal 3 doelen toe (optioneel)</p>
              {goals.map((goal, i) => (
                <div key={i} className="rounded-lg p-3 bg-white/[0.06] border border-bg-border">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-text-tertiary">Doel {i + 1}</span>
                    {goals.length > 1 && (
                      <button onClick={() => removeGoal(i)} className="text-xs text-[var(--color-status-bad)]">Verwijder</button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={goal.title}
                      onChange={(e) => updateGoal(i, 'title', e.target.value)}
                      placeholder="Bijv. Bench press 100kg"
                      className={INPUT_CLASSES}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={goal.category}
                        onChange={(e) => updateGoal(i, 'category', e.target.value)}
                        className="bg-white/[0.06] border border-bg-border text-text-primary rounded-[10px] px-2 py-1.5 text-xs outline-none"
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
                        className="bg-white/[0.06] border border-bg-border text-text-primary rounded-[10px] px-2 py-1.5 text-xs outline-none"
                      />
                      <input
                        type="text"
                        value={goal.targetUnit}
                        onChange={(e) => updateGoal(i, 'targetUnit', e.target.value)}
                        placeholder="kg, km…"
                        className="bg-white/[0.06] border border-bg-border text-text-primary rounded-[10px] px-2 py-1.5 text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {goals.length < 3 && (
                <button
                  onClick={addGoal}
                  className="text-sm text-[#0A84FF]"
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
            className="text-sm text-text-tertiary"
          >
            Overslaan
          </button>

          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-white/[0.06] text-text-primary"
              >
                Vorige
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-[#0A84FF] text-white disabled:opacity-50"
              >
                {saving ? 'Opslaan…' : 'Klaar'}
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-[#0A84FF] text-white"
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

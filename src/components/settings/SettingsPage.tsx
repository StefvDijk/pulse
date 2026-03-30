'use client'

import { useState, useEffect } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { SkeletonCard, SkeletonRect, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function useSaveStatus(): [SaveStatus, (fn: () => Promise<void>) => void] {
  const [status, setStatus] = useState<SaveStatus>('idle')

  const save = (fn: () => Promise<void>) => {
    setStatus('saving')
    fn()
      .then(() => {
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 2000)
      })
      .catch(() => setStatus('error'))
  }

  return [status, save]
}

function SaveButton({ status, onClick }: { status: SaveStatus; onClick: () => void }) {
  const label = status === 'saving' ? 'Opslaan…' : status === 'saved' ? 'Opgeslagen ✓' : 'Opslaan'
  return (
    <button
      onClick={onClick}
      disabled={status === 'saving'}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${
        status === 'saved' ? 'bg-status-green text-white' : 'bg-accent text-accent-text'
      }`}
    >
      {label}
    </button>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-4 text-base font-semibold text-text-primary">{title}</h2>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-tertiary">{label}</label>
      {children}
    </div>
  )
}

const INPUT_CLASSES = 'bg-bg-subtle border border-border-light text-text-primary rounded-[10px] px-3 py-2 text-sm outline-none'

export function SettingsPage() {
  const { data, isLoading, error, refresh } = useSettings()

  // Profile state
  const [displayName, setDisplayName] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [dietaryPref, setDietaryPref] = useState('')
  const [profileStatus, saveProfile] = useSaveStatus()

  // Connections state
  const [hevyKey, setHevyKey] = useState('')
  const [healthToken, setHealthToken] = useState('')
  const [connectStatus, saveConnections] = useSaveStatus()

  // Training goals state
  const [proteinPerKg, setProteinPerKg] = useState('')
  const [gymTarget, setGymTarget] = useState('')
  const [runTarget, setRunTarget] = useState('')
  const [padelTarget, setPadelTarget] = useState('')
  const [goalsStatus, saveGoals] = useSaveStatus()

  useEffect(() => {
    if (!data) return
    setDisplayName(data.profile.display_name ?? '')
    setWeightKg(data.profile.weight_kg?.toString() ?? '')
    setHeightCm(data.profile.height_cm?.toString() ?? '')
    setDietaryPref(data.profile.dietary_preference ?? 'omnivore')
    setHevyKey(data.settings.hevy_api_key ?? '')
    setHealthToken(data.settings.health_auto_export_token ?? '')
    setProteinPerKg(data.settings.protein_target_per_kg?.toString() ?? '')
    const wt = (data.settings.weekly_training_target ?? {}) as Record<string, number>
    setGymTarget(wt.gym?.toString() ?? '3')
    setRunTarget(wt.running?.toString() ?? '2')
    setPadelTarget(wt.padel?.toString() ?? '1')
  }, [data])

  async function handleSaveProfile() {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          display_name: displayName,
          weight_kg: weightKg ? Number(weightKg) : null,
          height_cm: heightCm ? Number(heightCm) : null,
          dietary_preference: dietaryPref || null,
        },
      }),
    }).then((r) => { if (!r.ok) throw new Error() })
    refresh()
  }

  async function handleSaveConnections() {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          hevy_api_key: hevyKey || null,
          health_auto_export_token: healthToken || null,
        },
      }),
    }).then((r) => { if (!r.ok) throw new Error() })
    refresh()
  }

  async function handleSaveGoals() {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          protein_target_per_kg: proteinPerKg ? Number(proteinPerKg) : null,
          weekly_training_target: {
            gym: Number(gymTarget) || 0,
            running: Number(runTarget) || 0,
            padel: Number(padelTarget) || 0,
          },
        },
      }),
    }).then((r) => { if (!r.ok) throw new Error() })
    refresh()
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="flex flex-col gap-3">
            <SkeletonLine width="w-1/4" />
            {[1,2].map(j => <SkeletonRect key={j} height="h-10" />)}
          </SkeletonCard>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 pt-6">
        <ErrorAlert message="Kon instellingen niet laden." onRetry={refresh} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-6">
      <h1 className="text-xl font-bold text-text-primary">Instellingen</h1>

      {/* Profile section */}
      <div className="bg-bg-card border border-border-light rounded-[14px] p-[14px_16px]">
        <SectionHeader title="Profiel" />
        <div className="flex flex-col gap-4">
          <Field label="Naam">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={INPUT_CLASSES}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gewicht (kg)">
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="75"
                min={20}
                max={300}
                step="0.1"
                className={INPUT_CLASSES}
              />
            </Field>
            <Field label="Lengte (cm)">
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="175"
                min={100}
                max={250}
                className={INPUT_CLASSES}
              />
            </Field>
          </div>
          <Field label="Voedingsvoorkeur">
            <select
              value={dietaryPref}
              onChange={(e) => setDietaryPref(e.target.value)}
              className={INPUT_CLASSES}
            >
              <option value="omnivore">Omnivoor</option>
              <option value="vegetarian">Vegetarisch</option>
              <option value="vegan">Veganistisch</option>
            </select>
          </Field>
          <div className="flex justify-end">
            <SaveButton status={profileStatus} onClick={() => saveProfile(handleSaveProfile)} />
          </div>
        </div>
      </div>

      {/* Connections section */}
      <div className="bg-bg-card border border-border-light rounded-[14px] p-[14px_16px]">
        <SectionHeader title="Koppelingen" />
        <div className="flex flex-col gap-4">
          <Field label="Hevy API key">
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={hevyKey}
                onChange={(e) => setHevyKey(e.target.value)}
                placeholder="sk-…"
                className={`flex-1 ${INPUT_CLASSES}`}
              />
              <StatusDot active={!!data?.settings.hevy_api_key} />
            </div>
          </Field>
          <Field label="Health Auto Export token">
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={healthToken}
                onChange={(e) => setHealthToken(e.target.value)}
                placeholder="token…"
                className={`flex-1 ${INPUT_CLASSES}`}
              />
              <StatusDot active={!!data?.settings.health_auto_export_token} />
            </div>
          </Field>
          <div className="flex justify-end">
            <SaveButton status={connectStatus} onClick={() => saveConnections(handleSaveConnections)} />
          </div>
        </div>
      </div>

      {/* Training goals section */}
      <div className="bg-bg-card border border-border-light rounded-[14px] p-[14px_16px]">
        <SectionHeader title="Trainingsdoelen" />
        <div className="flex flex-col gap-4">
          <Field label="Proteïne doel (g/kg lichaamsgewicht)">
            <input
              type="number"
              value={proteinPerKg}
              onChange={(e) => setProteinPerKg(e.target.value)}
              placeholder="2.0"
              min={0.5}
              max={5}
              step="0.1"
              className={INPUT_CLASSES}
            />
          </Field>
          <div>
            <p className="mb-2 text-xs font-medium text-text-tertiary">Wekelijkse sessies</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Gym">
                <input
                  type="number"
                  value={gymTarget}
                  onChange={(e) => setGymTarget(e.target.value)}
                  min={0}
                  max={14}
                  className={INPUT_CLASSES}
                />
              </Field>
              <Field label="Hardlopen">
                <input
                  type="number"
                  value={runTarget}
                  onChange={(e) => setRunTarget(e.target.value)}
                  min={0}
                  max={14}
                  className={INPUT_CLASSES}
                />
              </Field>
              <Field label="Padel">
                <input
                  type="number"
                  value={padelTarget}
                  onChange={(e) => setPadelTarget(e.target.value)}
                  min={0}
                  max={14}
                  className={INPUT_CLASSES}
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end">
            <SaveButton status={goalsStatus} onClick={() => saveGoals(handleSaveGoals)} />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <div
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: active ? '#16A34A' : '#D6D3CD' }}
      title={active ? 'Verbonden' : 'Niet verbonden'}
    />
  )
}

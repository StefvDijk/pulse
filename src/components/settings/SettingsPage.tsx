'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSettings } from '@/hooks/useSettings'
import { createClient } from '@/lib/supabase/client'
import { SkeletonCard, SkeletonRect, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { useSaveStatus, SaveButton, SectionHeader, Field, StatusDot, INPUT_CLASSES } from './shared'
import { AIContextSection } from './AIContextSection'
import { CoachToneSection, type CoachTone } from './CoachToneSection'
import { CoachingMemoryEditor } from './CoachingMemoryEditor'
import { WeeklyLessonsTimeline } from './WeeklyLessonsTimeline'
import { AIContextPreview } from './AIContextPreview'

export function SettingsPage() {
  const { data, isLoading, error, refresh } = useSettings()
  const searchParams = useSearchParams()
  const calendarStatus = searchParams.get('calendar') // 'connected' | 'error' | null

  // Google Calendar disconnect
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleDisconnectCalendar() {
    setDisconnecting(true)
    await fetch('/api/calendar/disconnect', { method: 'POST' })
      .catch(() => null)
    refresh()
    setDisconnecting(false)
  }

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

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordStatus, savePassword] = useSaveStatus()

  async function handleChangePassword() {
    setPasswordError(null)
    if (newPassword.length < 8) {
      setPasswordError('Wachtwoord moet minimaal 8 tekens zijn')
      throw new Error('validation')
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Wachtwoorden komen niet overeen')
      throw new Error('validation')
    }
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
      throw error
    }
    setNewPassword('')
    setConfirmPassword('')
  }

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
    <div className="flex flex-col gap-4 px-4 pb-24 pt-[60px]">
      <h1 className="text-[34px] font-bold tracking-[-0.8px] text-text-primary">Instellingen</h1>

      {/* Profile header */}
      <div
        className="flex items-center gap-3.5 rounded-[18px] border-[0.5px] border-bg-border-strong p-[18px]"
        style={{ background: 'linear-gradient(135deg, rgba(0,229,199,0.10), rgba(124,58,237,0.10))' }}
      >
        <div
          className="flex h-[60px] w-[60px] items-center justify-center rounded-full text-[24px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #00E5C7, #7C3AED)' }}
        >
          {(displayName || 'S').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold text-text-primary">{displayName || 'Pulse user'}</div>
          <div className="text-[12px] text-text-tertiary">
            {[heightCm && `${heightCm} cm`, weightKg && `${weightKg} kg`].filter(Boolean).join(' · ') || 'Bewerk profiel hieronder'}
          </div>
        </div>
      </div>

      {/* Profile section */}
      <div className="bg-bg-surface border-[0.5px] border-bg-border rounded-[18px] p-[16px_18px]">
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
      <div className="bg-bg-surface border-[0.5px] border-bg-border rounded-[18px] p-[16px_18px]">
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

      {/* Google Calendar section */}
      <div className="bg-bg-surface border-[0.5px] border-bg-border rounded-[18px] p-[16px_18px]">
        <SectionHeader title="Google Agenda" />

        {calendarStatus === 'connected' && (
          <div className="mb-3 rounded-lg bg-[var(--color-status-good)]/10 px-3 py-2 text-sm text-[var(--color-status-good)]">
            Google Agenda gekoppeld ✓
          </div>
        )}
        {calendarStatus === 'error' && (
          <div className="mb-3 rounded-lg bg-[var(--color-status-bad)]/10 px-3 py-2 text-sm text-[var(--color-status-bad)]">
            Koppeling mislukt — probeer opnieuw.
          </div>
        )}

        {data?.settings.google_calendar_email ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot active />
              <div>
                <p className="text-sm font-medium text-text-primary">Verbonden</p>
                {data.settings.google_calendar_email && (
                  <p className="text-xs text-text-tertiary">{data.settings.google_calendar_email}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleDisconnectCalendar}
              disabled={disconnecting}
              className="rounded-lg border border-bg-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              {disconnecting ? 'Ontkoppelen…' : 'Ontkoppel'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot active={false} />
              <p className="text-sm text-text-secondary">Niet gekoppeld</p>
            </div>
            <a
              href="/api/calendar/auth"
              className="rounded-lg bg-[#0A84FF] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              Koppel Google Agenda
            </a>
          </div>
        )}
      </div>

      {/* Training goals section */}
      <div className="bg-bg-surface border-[0.5px] border-bg-border rounded-[18px] p-[16px_18px]">
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

      {/* Account section */}
      <div className="bg-bg-surface border-[0.5px] border-bg-border rounded-[18px] p-[16px_18px]">
        <SectionHeader title="Wachtwoord wijzigen" />
        <div className="flex flex-col gap-4">
          <Field label="Nieuw wachtwoord">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimaal 8 tekens"
              autoComplete="new-password"
              className={INPUT_CLASSES}
            />
          </Field>
          <Field label="Bevestig nieuw wachtwoord">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={INPUT_CLASSES}
            />
          </Field>
          {passwordError && (
            <p className="text-sm text-[var(--color-status-bad)]">{passwordError}</p>
          )}
          <div className="flex justify-end">
            <SaveButton
              status={passwordStatus}
              onClick={() => savePassword(handleChangePassword)}
            />
          </div>
        </div>
      </div>

      {/* AI Coach section */}
      <h2 className="mt-4 text-lg font-semibold text-text-primary">AI Coach</h2>

      <CoachToneSection
        currentValue={(data?.settings.coach_tone ?? null) as CoachTone | null}
        onSaved={refresh}
      />

      <AIContextSection
        currentValue={data?.settings.ai_custom_instructions ?? null}
        onSaved={refresh}
      />

      <CoachingMemoryEditor />

      <WeeklyLessonsTimeline />

      <AIContextPreview />
    </div>
  )
}


'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSettings } from '@/hooks/useSettings'
import { createClient } from '@/lib/supabase/client'
import { SkeletonCard, SkeletonRect, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { useSaveStatus, SaveButton, Field, StatusDot, INPUT_CLASSES } from './shared'
import { AIContextSection } from './AIContextSection'
import { CoachToneSection, type CoachTone } from './CoachToneSection'
import { CoachingMemoryEditor } from './CoachingMemoryEditor'
import { WeeklyLessonsTimeline } from './WeeklyLessonsTimeline'
import { AIContextPreview } from './AIContextPreview'
import { ProfileHeader } from './v2/ProfileHeader'
import { FormSection } from './v2/FormSection'
import { SyncButton } from '@/components/home/SyncButton'

export function SettingsPage() {
  const { data, isLoading, error, refresh } = useSettings()
  const searchParams = useSearchParams()
  const calendarStatus = searchParams.get('calendar') // 'connected' | 'error' | null
  const stravaStatus = searchParams.get('strava') // 'connected' | 'error' | 'missing_scope' | null

  // Google Calendar disconnect
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleDisconnectCalendar() {
    setDisconnecting(true)
    await fetch('/api/calendar/disconnect', { method: 'POST' })
      .catch(() => null)
    refresh()
    setDisconnecting(false)
  }

  // Strava disconnect + manual sync
  const [stravaDisconnecting, setStravaDisconnecting] = useState(false)
  const [stravaSyncing, setStravaSyncing] = useState(false)
  const [stravaSyncMessage, setStravaSyncMessage] = useState<string | null>(null)

  async function handleDisconnectStrava() {
    setStravaDisconnecting(true)
    await fetch('/api/strava/disconnect', { method: 'POST' }).catch(() => null)
    refresh()
    setStravaDisconnecting(false)
  }

  async function handleStravaSync() {
    setStravaSyncing(true)
    setStravaSyncMessage(null)
    try {
      const res = await fetch('/api/strava/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        fetched?: number
        synced?: number
        error?: string
      }
      if (!res.ok) {
        setStravaSyncMessage(body.error ?? 'Sync mislukt')
      } else {
        setStravaSyncMessage(`${body.synced ?? 0} activiteit(en) opgehaald`)
      }
    } catch (err) {
      console.error('[strava sync]', err)
      setStravaSyncMessage('Sync mislukt')
    } finally {
      setStravaSyncing(false)
      setTimeout(() => setStravaSyncMessage(null), 4000)
    }
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

  // Track the data identity we've already mirrored into local form state so
  // we can re-sync exactly once per fetch (during render, per React docs).
  const [syncedData, setSyncedData] = useState(data)

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

  // React docs idiom: hydrate form fields during render when the fetched
  // settings object identity changes (mount + after refresh()). Avoids a
  // useEffect(setX, [data]) cascade that triggers extra render cycles.
  if (data && data !== syncedData) {
    setSyncedData(data)
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
  }

  async function patchSettings(payload: Record<string, unknown>): Promise<void> {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? `Server-fout (${res.status})`)
    }
  }

  async function handleSaveProfile() {
    await patchSettings({
      profile: {
        display_name: displayName,
        weight_kg: weightKg ? Number(weightKg) : null,
        height_cm: heightCm ? Number(heightCm) : null,
        dietary_preference: dietaryPref || null,
      },
    })
    refresh()
  }

  async function handleSaveConnections() {
    await patchSettings({
      settings: {
        hevy_api_key: hevyKey || null,
        health_auto_export_token: healthToken || null,
      },
    })
    refresh()
  }

  async function handleSaveGoals() {
    await patchSettings({
      settings: {
        protein_target_per_kg: proteinPerKg ? Number(proteinPerKg) : null,
        weekly_training_target: {
          gym: Number(gymTarget) || 0,
          running: Number(runTarget) || 0,
          padel: Number(padelTarget) || 0,
        },
      },
    })
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

      {/* Profile header — v2 gradient card */}
      <ProfileHeader
        displayName={displayName}
        weightKg={weightKg}
        heightCm={heightCm}
      />

      {/* Profile form */}
      <FormSection title="Profiel">
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
            <SaveButton state={profileStatus} onClick={() => saveProfile(handleSaveProfile)} />
          </div>
        </div>
      </FormSection>

      {/* Connections form */}
      <FormSection title="Koppelingen">
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
            <SaveButton state={connectStatus} onClick={() => saveConnections(handleSaveConnections)} />
          </div>
        </div>
      </FormSection>

      {/* Manual sync trigger — Hevy + aggregaties */}
      <FormSection title="Synchronisatie">
        <SyncButton />
      </FormSection>

      {/* Google Calendar */}
      <FormSection title="Google Agenda">
        {calendarStatus === 'connected' && (
          <div className="mb-3 rounded-[10px] bg-status-good/10 px-3 py-2 text-sm text-status-good">
            Google Agenda gekoppeld ✓
          </div>
        )}
        {calendarStatus === 'error' && (
          <div className="mb-3 rounded-[10px] bg-status-bad/10 px-3 py-2 text-sm text-status-bad">
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
              className="rounded-[10px] border-[0.5px] border-bg-border px-3 py-1.5 text-sm text-text-secondary transition-colors active:opacity-60 disabled:opacity-50"
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
              className="rounded-[10px] bg-[#0A84FF] px-3 py-1.5 text-sm font-medium text-white transition-opacity active:opacity-80"
            >
              Koppel Google Agenda
            </a>
          </div>
        )}
      </FormSection>

      {/* Strava */}
      <FormSection title="Strava">
        {stravaStatus === 'connected' && (
          <div className="mb-3 rounded-[10px] bg-status-good/10 px-3 py-2 text-sm text-status-good">
            Strava gekoppeld ✓
          </div>
        )}
        {stravaStatus === 'error' && (
          <div className="mb-3 rounded-[10px] bg-status-bad/10 px-3 py-2 text-sm text-status-bad">
            Koppeling mislukt — probeer opnieuw.
          </div>
        )}
        {stravaStatus === 'missing_scope' && (
          <div className="mb-3 rounded-[10px] bg-status-warn/10 px-3 py-2 text-sm text-status-warn">
            Geef Pulse toestemming om alle activiteiten te lezen (vink &ldquo;Bekijk gegevens over privé-activiteiten&rdquo; aan).
          </div>
        )}

        {data?.settings.strava_athlete_id ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot active />
                <div>
                  <p className="text-sm font-medium text-text-primary">Verbonden</p>
                  {data.settings.strava_athlete_name && (
                    <p className="text-xs text-text-tertiary">{data.settings.strava_athlete_name}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleDisconnectStrava}
                disabled={stravaDisconnecting}
                className="rounded-[10px] border-[0.5px] border-bg-border px-3 py-1.5 text-sm text-text-secondary transition-colors active:opacity-60 disabled:opacity-50"
              >
                {stravaDisconnecting ? 'Ontkoppelen…' : 'Ontkoppel'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={handleStravaSync}
                disabled={stravaSyncing}
                className="rounded-[10px] bg-[#0A84FF]/10 px-3 py-1.5 text-sm font-medium text-[#0A84FF] transition-opacity active:opacity-80 disabled:opacity-50"
              >
                {stravaSyncing ? 'Syncen…' : 'Sync laatste 30 dagen'}
              </button>
              {stravaSyncMessage && (
                <span className="text-xs text-text-tertiary">{stravaSyncMessage}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot active={false} />
              <p className="text-sm text-text-secondary">Niet gekoppeld</p>
            </div>
            <a
              href="/api/strava/oauth/start"
              className="rounded-[10px] bg-[#FC4C02] px-3 py-1.5 text-sm font-medium text-white transition-opacity active:opacity-80"
            >
              Koppel Strava
            </a>
          </div>
        )}
      </FormSection>

      {/* Training goals */}
      <FormSection title="Trainingsdoelen">
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
            <SaveButton state={goalsStatus} onClick={() => saveGoals(handleSaveGoals)} />
          </div>
        </div>
      </FormSection>

      {/* Account — password change */}
      <FormSection title="Wachtwoord wijzigen">
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
            <p className="text-sm text-status-bad">{passwordError}</p>
          )}
          <div className="flex justify-end">
            <SaveButton
              state={passwordStatus}
              onClick={() => savePassword(handleChangePassword)}
            />
          </div>
        </div>
      </FormSection>

      {/* AI Coach section label */}
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-text-tertiary px-1">
        AI Coach
      </p>

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


'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'pulse-install-dismissed-at'
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari exposes a non-standard flag.
  return Boolean((window.navigator as { standalone?: boolean }).standalone)
}

function recentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return false
  const ts = Number.parseInt(raw, 10)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < COOLDOWN_MS
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    const handler = (e: Event) => {
      e.preventDefault()
      setEvt(e as BeforeInstallPromptEvent)
      // Wait a beat so we don't pop the banner on cold load.
      window.setTimeout(() => setVisible(true), 4000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch {
      // ignore — private mode etc.
    }
  }

  const install = async () => {
    if (!evt) return
    try {
      await evt.prompt()
      await evt.userChoice
    } catch (err) {
      console.error('[InstallPrompt] prompt failed:', err)
    } finally {
      setEvt(null)
      dismiss()
    }
  }

  if (!visible || !evt) return null

  return (
    <div
      role="dialog"
      aria-label="Pulse installeren"
      className="fixed inset-x-3 bottom-[100px] z-50 mx-auto max-w-md rounded-[22px] border border-bg-border bg-bg-surface/95 p-4 shadow-apple-lg backdrop-blur-xl lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-aurora text-white">
          <span className="text-base font-bold">P</span>
        </div>
        <div className="flex-1">
          <p className="text-headline text-text-primary">Pulse installeren</p>
          <p className="mt-0.5 text-caption1 text-text-secondary">
            Voeg toe aan je beginscherm voor sneller starten en een full-screen ervaring.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={install}
              className="rounded-full bg-[#0A84FF] px-4 py-1.5 text-caption1 font-semibold text-white transition-transform active:scale-95"
            >
              Installeer
            </button>
            <button
              onClick={dismiss}
              className="rounded-full px-4 py-1.5 text-caption1 font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

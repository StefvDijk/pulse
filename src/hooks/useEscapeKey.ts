'use client'

import { useEffect } from 'react'

/**
 * Calls `onEscape` when the Escape key is pressed while `active` is true.
 * No-op when inactive — safe to mount unconditionally.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onEscape])
}

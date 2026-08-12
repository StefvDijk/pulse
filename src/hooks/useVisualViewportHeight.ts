'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onStoreChange: () => void): () => void {
  const viewport = window.visualViewport
  if (!viewport) {
    window.addEventListener('resize', onStoreChange)
    return () => window.removeEventListener('resize', onStoreChange)
  }
  viewport.addEventListener('resize', onStoreChange)
  viewport.addEventListener('scroll', onStoreChange)
  return () => {
    viewport.removeEventListener('resize', onStoreChange)
    viewport.removeEventListener('scroll', onStoreChange)
  }
}

function snapshot(): number {
  return Math.round(window.visualViewport?.height ?? window.innerHeight)
}

/** Current visible viewport height, including iOS software-keyboard changes. */
export function useVisualViewportHeight(): number | null {
  const height = useSyncExternalStore(subscribe, snapshot, () => 0)
  return height > 0 ? height : null
}

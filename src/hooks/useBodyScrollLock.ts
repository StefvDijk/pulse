'use client'

import { useEffect } from 'react'

/**
 * Locks body scroll while `active` is true. Restores the previous scroll
 * position and inline styles on cleanup.
 *
 * iOS Safari needs more than `overflow:hidden` — without `position:fixed`
 * the page still scrolls behind a modal. We pin the body and restore the
 * scroll offset on unmount so the underlying view doesn't jump.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return

    const { body } = document
    const scrollY = window.scrollY
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    }

    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      body.style.overflow = prev.overflow
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      window.scrollTo(0, scrollY)
    }
  }, [active])
}

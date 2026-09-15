'use client'

import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Keep keyboard focus inside an active modal and restore it after close.
 * The container must have tabIndex={-1} so empty dialogs remain focusable.
 */
export function useDialogFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options: { autoFocus?: boolean; restoreFocus?: boolean } = {},
): void {
  const { autoFocus = true, restoreFocus = true } = options

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return
    const activeContainer = container
    const previousFocus = document.activeElement as HTMLElement | null
    const focusables = () =>
      Array.from(activeContainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

    if (autoFocus) focusables()[0]?.focus()
    if (!autoFocus || document.activeElement === previousFocus) activeContainer.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const elements = focusables()
      if (elements.length === 0) {
        event.preventDefault()
        activeContainer.focus()
        return
      }

      const first = elements[0]
      const last = elements.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (restoreFocus && previousFocus?.isConnected) previousFocus.focus()
    }
  }, [active, autoFocus, containerRef, restoreFocus])
}

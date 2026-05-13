'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { sheetPresentation } from '@/lib/motion-presets'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useEscapeKey } from '@/hooks/useEscapeKey'

export type SheetDetent = 'medium' | 'large'

export interface SheetProps {
  open: boolean
  onClose: () => void
  detents?: SheetDetent[]
  title?: string
  grabber?: boolean
  children: ReactNode
  className?: string
}

/**
 * Sheet — iOS 26 sheet-presentation primitive.
 *
 * Backdrop + glass surface + grabber + body scroll lock + ESC + focus trap.
 * Use for modals, action sheets, drilldowns. NOT for content cards.
 *
 * Detents:
 * - default `['large']` — fills ~90vh
 * - `['medium', 'large']` — starts at ~50vh, draggable up to 90vh
 *
 * Swipe down past 120px of current detent closes the sheet.
 */
export function Sheet({
  open,
  onClose,
  detents = ['large'],
  title,
  grabber = true,
  children,
  className = '',
}: SheetProps) {
  useBodyScrollLock(open)
  // useEscapeKey takes (active: boolean, onEscape: () => void)
  useEscapeKey(open, onClose)

  // Focus trap: store previous focus, restore on close
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement
      const focusables = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables && focusables.length > 0) {
        focusables[0].focus()
      } else {
        sheetRef.current?.focus()
      }
    } else if (previousFocus.current) {
      previousFocus.current.focus()
      previousFocus.current = null
    }
  }, [open])

  // SSR guard for portal
  if (typeof window === 'undefined') return null

  const initialHeight = detents[0] === 'medium' ? '50vh' : '90vh'
  const maxHeight = detents.includes('large') ? '90vh' : '50vh'

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            data-testid="sheet-backdrop"
            className="fixed inset-0 z-40 bg-bg-dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={[
              'fixed left-0 right-0 bottom-0 z-50',
              'lg:max-w-md lg:left-1/2 lg:-translate-x-1/2',
              'glass-sheet rounded-t-[28px]',
              'pb-safe pl-safe pr-safe',
              'flex flex-col overflow-hidden',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ height: initialHeight, maxHeight }}
            variants={sheetPresentation}
            initial="initial"
            animate="animate"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose()
            }}
          >
            {grabber && (
              <div className="flex justify-center pt-2 pb-3 shrink-0">
                <div
                  data-testid="sheet-grabber"
                  className="h-1 w-9 rounded-full bg-text-tertiary"
                  aria-hidden="true"
                />
              </div>
            )}
            {title && (
              <div className="px-5 pb-3 text-center text-pulse-title text-text-primary shrink-0">
                {title}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

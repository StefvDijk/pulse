'use client'

import { useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useEscapeKey } from '@/hooks/useEscapeKey'

export interface AlertAction {
  label: string
  onPress: () => void
  destructive?: boolean
}

export interface AlertProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  primaryAction: AlertAction
  secondaryAction?: AlertAction
}

const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const dialogVariants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 28 } },
  exit: { opacity: 0, scale: 0.92, transition: { duration: 0.15 } },
}

/**
 * Alert — centered confirmation dialog (not bottom-anchored).
 *
 * Used for destructive confirmations or brief choices. For large forms or
 * drilldowns use `<Sheet>` instead.
 */
export function Alert({
  open,
  onClose,
  title,
  description,
  primaryAction,
  secondaryAction,
}: AlertProps) {
  useBodyScrollLock(open)
  useEscapeKey(open, onClose)

  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables && focusables.length > 0) {
        focusables[0].focus()
      } else {
        dialogRef.current?.focus()
      }
    } else if (previousFocus.current) {
      previousFocus.current.focus()
      previousFocus.current = null
    }
  }, [open])

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            data-testid="alert-backdrop"
            className="fixed inset-0 z-50 bg-bg-dim"
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-title"
            aria-describedby={description ? 'alert-description' : undefined}
            tabIndex={-1}
            data-testid="alert-dialog"
            className={[
              'fixed left-1/2 top-1/2 z-50 w-full max-w-xs -translate-x-1/2 -translate-y-1/2',
              'glass-sheet rounded-[22px] px-5 py-5',
              'flex flex-col gap-4',
            ].join(' ')}
            variants={dialogVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* Text */}
            <div className="flex flex-col gap-1 text-center">
              <h2
                id="alert-title"
                className="text-body-l font-semibold text-text-primary"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="alert-description"
                  className="text-body-s text-text-secondary"
                >
                  {description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  primaryAction.onPress()
                  onClose()
                }}
                className={[
                  'w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity active:opacity-70',
                  primaryAction.destructive
                    ? 'bg-[var(--color-status-bad)] text-white'
                    : 'bg-[#0A84FF] text-white',
                ].join(' ')}
              >
                {primaryAction.label}
              </button>
              {secondaryAction && (
                <button
                  type="button"
                  onClick={() => {
                    secondaryAction.onPress()
                    onClose()
                  }}
                  className="w-full rounded-xl bg-white/[0.08] px-4 py-2.5 text-sm font-medium text-text-secondary transition-opacity active:opacity-70"
                >
                  {secondaryAction.label}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  ) as ReactNode
}

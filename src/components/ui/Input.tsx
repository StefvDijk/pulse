import { InputHTMLAttributes, ReactNode, forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leading?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leading,
    trailing,
    className = '',
    id,
    ...props
  },
  ref,
) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  const inputCls = [
    'flex-1 h-11 bg-transparent text-body-l text-text-primary',
    'placeholder:text-text-tertiary',
    'focus:outline-none',
    leading ? '' : 'pl-4',
    trailing ? '' : 'pr-4',
  ]
    .filter(Boolean)
    .join(' ')

  const wrapperCls = [
    'flex items-center',
    'bg-bg-surface border-[0.5px] border-bg-border rounded-card-md',
    'transition-all duration-150',
    'focus-within:ring-1 focus-within:ring-text-primary/20 focus-within:border-bg-border-strong',
    error ? 'border-status-bad' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col">
      {label && (
        <label
          htmlFor={inputId}
          className="text-body-s text-text-secondary mb-1"
        >
          {label}
        </label>
      )}

      <div className={wrapperCls}>
        {leading && (
          <span className="flex items-center justify-center w-11 shrink-0 text-text-secondary">
            {leading}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          className={inputCls}
          {...props}
        />

        {trailing && (
          <span className="flex items-center justify-center w-11 shrink-0 text-text-secondary">
            {trailing}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-body-s text-status-bad mt-1">{error}</p>
      ) : hint ? (
        <p className="text-body-s text-text-tertiary mt-1">{hint}</p>
      ) : null}
    </div>
  )
})

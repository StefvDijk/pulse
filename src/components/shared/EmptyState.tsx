import Link from 'next/link'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void } | { label: string; href: string }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-bg-border bg-bg-surface p-10 text-center">
      {icon && (
        <div className="mb-4 text-text-tertiary">
          {icon}
        </div>
      )}
      <p className="mb-1 text-base font-semibold text-text-primary">
        {title}
      </p>
      {description && (
        <p className="mb-5 text-sm text-text-secondary">
          {description}
        </p>
      )}
      {action && (
        'href' in action ? (
          <Link
            href={action.href}
            className="rounded-lg bg-[#0A84FF] px-4 py-2 text-sm font-medium text-white"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="rounded-lg bg-[#0A84FF] px-4 py-2 text-sm font-medium text-white"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}

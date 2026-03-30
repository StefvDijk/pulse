import Link from 'next/link'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void } | { label: string; href: string }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl p-10 text-center"
      style={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e' }}
    >
      {icon && (
        <div className="mb-4" style={{ color: '#8888a0' }}>
          {icon}
        </div>
      )}
      <p className="mb-1 text-base font-semibold" style={{ color: '#f0f0f5' }}>
        {title}
      </p>
      {description && (
        <p className="mb-5 text-sm" style={{ color: '#8888a0' }}>
          {description}
        </p>
      )}
      {action && (
        'href' in action ? (
          <Link
            href={action.href}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: '#4f8cff', color: '#fff' }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: '#4f8cff', color: '#fff' }}
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}

export function SkeletonLine({ width = 'w-1/2', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`${width} ${height} rounded bg-system-gray6`} />
}

export function SkeletonRect({ height = 'h-24' }: { height?: string }) {
  return <div className={`w-full ${height} rounded-lg bg-system-gray6`} />
}

export function SkeletonCircle({ size = 'h-12 w-12' }: { size?: string }) {
  return <div className={`${size} rounded-full bg-system-gray6`} />
}

export function SkeletonCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`animate-pulse rounded-xl border border-separator bg-surface-primary p-5 ${className ?? ''}`}>
      {children}
    </div>
  )
}

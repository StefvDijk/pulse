export function SkeletonLine({ width = 'w-1/2', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`${width} ${height} rounded bg-bg-subtle`} />
}

export function SkeletonRect({ height = 'h-24' }: { height?: string }) {
  return <div className={`w-full ${height} rounded-lg bg-bg-subtle`} />
}

export function SkeletonCircle({ size = 'h-12 w-12' }: { size?: string }) {
  return <div className={`${size} rounded-full bg-bg-subtle`} />
}

export function SkeletonCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`animate-pulse rounded-xl border border-border-light bg-bg-card p-5 ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function SkeletonLine({ width = 'w-1/2', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`${width} ${height} rounded`} style={{ backgroundColor: '#1a1a2e' }} />
}

export function SkeletonRect({ height = 'h-24' }: { height?: string }) {
  return <div className={`w-full ${height} rounded-lg`} style={{ backgroundColor: '#1a1a2e' }} />
}

export function SkeletonCircle({ size = 'h-12 w-12' }: { size?: string }) {
  return <div className={`${size} rounded-full`} style={{ backgroundColor: '#1a1a2e' }} />
}

export function SkeletonCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`animate-pulse rounded-xl p-5 ${className ?? ''}`}
      style={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e' }}
    >
      {children}
    </div>
  )
}

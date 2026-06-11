import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-3.5 px-4 pb-24 pt-[60px]">
      <div className="pt-1">
        <div className="h-[34px] w-40 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="mt-2 h-3 w-56 animate-pulse rounded bg-white/[0.04]" />
      </div>
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="flex flex-col gap-3">
          <SkeletonLine width="w-1/3" />
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="flex items-center justify-between gap-3">
              <SkeletonLine width="w-1/4" height="h-3" />
              <SkeletonLine width="w-1/5" height="h-3" />
              <SkeletonLine width="w-1/5" height="h-3" />
            </div>
          ))}
        </SkeletonCard>
      ))}
    </div>
  )
}

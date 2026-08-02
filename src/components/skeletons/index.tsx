import { Skeleton, LoadingRegion } from '../ui'

/**
 * Loading states mirror the real layout of each screen so the page doesn't
 * jump when data lands. These replace the bare "Loading…" text nodes.
 */

function HeaderSkeleton() {
  return (
    <div className="space-y-3 border-b border-rule pb-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  )
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid divide-y divide-rule border-y border-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 px-5 py-5 first:pl-0 last:pr-0">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rule-list rounded-md border border-rule bg-surface">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 sm:p-5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-sm sm:h-11 sm:w-11" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5 max-w-xs" />
            <Skeleton className="h-3 w-2/5 max-w-[10rem]" />
          </div>
          <Skeleton className="hidden h-8 w-20 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-md border border-rule bg-surface p-5">
          <Skeleton className="h-10 w-10 rounded-sm" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <LoadingRegion label="Loading your dashboard">
      <div className="space-y-8">
        <Skeleton className="h-40 w-full rounded-md sm:h-44" />
        <StatRowSkeleton />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-3 w-32" />
            <ListSkeleton rows={3} />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-3 w-28" />
            <ListSkeleton rows={3} />
          </div>
        </div>
      </div>
    </LoadingRegion>
  )
}

export function PageListSkeleton({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <LoadingRegion label={label}>
      <div className="space-y-8">
        <HeaderSkeleton />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <ListSkeleton rows={rows} />
      </div>
    </LoadingRegion>
  )
}

export function DetailSkeleton() {
  return (
    <LoadingRegion label="Loading scholarship">
      <div className="space-y-8">
        <Skeleton className="h-52 w-full rounded-md sm:h-60" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <ListSkeleton rows={4} />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-md" />
            <Skeleton className="h-64 w-full rounded-md" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading records">
      <div className="rule-list rounded-md border border-rule bg-surface">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-24 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-32 shrink-0 sm:block" />
            <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

/** Full-screen boot state used by the route guards. */
export function RouteFallback() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-dot-pulse rounded-full bg-accent"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="t-overline text-ink-muted">Loading ScholarCircle</p>
      </div>
    </div>
  )
}

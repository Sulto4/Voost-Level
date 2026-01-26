import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse', // Could implement wave animation if needed
    none: '',
  }

  const style: React.CSSProperties = {
    width: width,
    height: height,
  }

  return (
    <div
      className={clsx(
        'bg-slate-200 dark:bg-slate-700',
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
      aria-hidden="true"
    />
  )
}

// Pre-built skeleton patterns for common use cases
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full" animation="none" />
        </td>
      ))}
    </tr>
  )
}

export function CardSkeleton() {
  return (
    <div className="card p-6 animate-pulse">
      <Skeleton className="h-6 w-1/3 mb-4" animation="none" />
      <Skeleton className="h-4 w-full mb-2" animation="none" />
      <Skeleton className="h-4 w-2/3" animation="none" />
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="circular" className="h-10 w-10" animation="none" />
        <Skeleton className="h-4 w-12" animation="none" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" animation="none" />
      <Skeleton className="h-4 w-24" animation="none" />
    </div>
  )
}

export function ClientTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden animate-pulse">
      {/* Header skeleton */}
      <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-3 flex gap-6">
        <Skeleton className="h-4 w-24" animation="none" />
        <Skeleton className="h-4 w-16" animation="none" />
        <Skeleton className="h-4 w-16" animation="none" />
        <Skeleton className="h-4 w-16" animation="none" />
        <Skeleton className="h-4 w-16" animation="none" />
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-6 items-center">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton variant="circular" className="h-10 w-10" animation="none" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-1" animation="none" />
              <Skeleton className="h-3 w-24" animation="none" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" animation="none" />
          <Skeleton className="h-4 w-16" animation="none" />
          <Skeleton className="h-4 w-20" animation="none" />
          <Skeleton className="h-8 w-8 rounded" animation="none" />
        </div>
      ))}
    </div>
  )
}

import { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'

interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => Promise<void> | void
  className?: string
}

export function PullToRefresh({ children, onRefresh, className = '' }: PullToRefreshProps) {
  const {
    pullDistance,
    isRefreshing,
    pullProgress,
    handlers,
  } = usePullToRefresh({ onRefresh })

  const showIndicator = pullDistance > 0 || isRefreshing

  return (
    <div
      {...handlers}
      className={`relative ${className}`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center transition-transform overflow-hidden z-10"
        style={{
          top: 0,
          transform: `translateY(${pullDistance - 40}px)`,
          opacity: showIndicator ? 1 : 0,
        }}
      >
        <div
          className={`
            p-2 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700
            transition-all duration-200
          `}
          style={{
            transform: `rotate(${pullProgress * 360}deg)`,
          }}
        >
          <RefreshCw
            className={`h-5 w-5 text-primary-600 dark:text-primary-400 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </div>
      </div>

      {/* Content wrapper */}
      <div
        className="transition-transform duration-100"
        style={{
          transform: showIndicator ? `translateY(${pullDistance}px)` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}

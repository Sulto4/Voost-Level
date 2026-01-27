import { useState, useCallback, useRef, useEffect } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  threshold?: number // Distance in pixels to trigger refresh (default: 80)
  maxPull?: number // Maximum pull distance (default: 150)
}

interface UsePullToRefreshReturn {
  isPulling: boolean
  pullDistance: number
  isRefreshing: boolean
  pullProgress: number // 0 to 1
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
  }
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 150,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start pulling if scrolled to top
    const element = e.currentTarget as HTMLElement
    const scrollTop = element.scrollTop || window.scrollY || document.documentElement.scrollTop

    if (scrollTop <= 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY
      setIsPulling(true)
    }
  }, [isRefreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return

    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current

    if (diff > 0) {
      // Apply resistance - the further you pull, the harder it gets
      const distance = Math.min(diff * 0.5, maxPull)
      setPullDistance(distance)
    }
  }, [isPulling, isRefreshing, maxPull])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return

    setIsPulling(false)

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(threshold) // Keep indicator visible during refresh

      try {
        await onRefresh()
      } catch (error) {
        console.error('Refresh failed:', error)
      }

      setIsRefreshing(false)
    }

    setPullDistance(0)
    startY.current = 0
    currentY.current = 0
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh])

  // Calculate progress (0 to 1)
  const pullProgress = Math.min(pullDistance / threshold, 1)

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    pullProgress,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}

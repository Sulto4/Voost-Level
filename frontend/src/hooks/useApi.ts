import { useState, useCallback } from 'react'
import api, { ApiResponse, RateLimitHeaders } from '../lib/api'

interface UseApiState<T> {
  data: T | null
  error: Error | null
  loading: boolean
  headers: RateLimitHeaders | null
  status: number | null
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: () => Promise<ApiResponse<T>>
  reset: () => void
}

/**
 * Hook for making API requests with rate limit tracking
 */
export function useApi<T>(
  queryFn: () => Promise<{ data: T | null; error: Error | null }>
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    loading: false,
    headers: null,
    status: null,
  })

  const execute = useCallback(async (): Promise<ApiResponse<T>> => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    const response = await api.query<T>(queryFn)

    setState({
      data: response.data,
      error: response.error,
      loading: false,
      headers: response.headers,
      status: response.status,
    })

    return response
  }, [queryFn])

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      loading: false,
      headers: null,
      status: null,
    })
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
}

/**
 * Hook for getting current rate limit status
 */
export function useRateLimitStatus(): RateLimitHeaders {
  return api.getRateLimitStatus()
}

export default useApi

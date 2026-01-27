/**
 * API wrapper with rate limiting support
 *
 * This module provides a thin wrapper around Supabase operations that:
 * 1. Tracks API requests per window
 * 2. Returns rate limit headers with each response
 * 3. Implements client-side rate limiting when limits are reached
 */

import { supabase } from './supabase'

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  limit: 100, // Maximum requests per window
  windowMs: 60 * 1000, // 1 minute window in milliseconds
}

// Track request counts per window
interface RateLimitState {
  count: number
  windowStart: number
}

let rateLimitState: RateLimitState = {
  count: 0,
  windowStart: Date.now(),
}

/**
 * Reset rate limit window if expired
 */
function checkAndResetWindow(): void {
  const now = Date.now()
  if (now - rateLimitState.windowStart >= RATE_LIMIT_CONFIG.windowMs) {
    rateLimitState = {
      count: 0,
      windowStart: now,
    }
  }
}

/**
 * Increment request count and return rate limit headers
 */
function getRateLimitHeaders(): RateLimitHeaders {
  checkAndResetWindow()
  rateLimitState.count++

  const remaining = Math.max(0, RATE_LIMIT_CONFIG.limit - rateLimitState.count)
  const resetTime = rateLimitState.windowStart + RATE_LIMIT_CONFIG.windowMs

  return {
    'X-RateLimit-Limit': RATE_LIMIT_CONFIG.limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.floor(resetTime / 1000).toString(),
  }
}

/**
 * Check if rate limit is exceeded
 */
function isRateLimited(): boolean {
  checkAndResetWindow()
  return rateLimitState.count >= RATE_LIMIT_CONFIG.limit
}

/**
 * Get time until rate limit resets (in seconds)
 */
function getRetryAfter(): number {
  const now = Date.now()
  const resetTime = rateLimitState.windowStart + RATE_LIMIT_CONFIG.windowMs
  return Math.max(0, Math.ceil((resetTime - now) / 1000))
}

// Types for rate limit headers
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string
  'X-RateLimit-Reset': string
  'Retry-After'?: string
}

// Generic API response type
export interface ApiResponse<T> {
  data: T | null
  error: Error | null
  headers: RateLimitHeaders
  status: number
}

/**
 * Create an API response with rate limit headers
 */
function createApiResponse<T>(
  data: T | null,
  error: Error | null,
  status: number
): ApiResponse<T> {
  const headers = getRateLimitHeaders()

  if (isRateLimited()) {
    headers['Retry-After'] = getRetryAfter().toString()
  }

  return {
    data,
    error,
    headers,
    status,
  }
}

/**
 * Wrap a Supabase query with rate limiting
 */
export async function apiRequest<T>(
  queryFn: () => Promise<{ data: T | null; error: Error | null }>
): Promise<ApiResponse<T>> {
  // Check if rate limited before making request
  if (isRateLimited()) {
    const retryAfter = getRetryAfter()
    return createApiResponse<T>(
      null,
      new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`),
      429
    )
  }

  try {
    const result = await queryFn()
    const status = result.error ? 400 : 200
    return createApiResponse(result.data, result.error, status)
  } catch (error) {
    return createApiResponse<T>(null, error as Error, 500)
  }
}

/**
 * API methods with rate limiting
 */
export const api = {
  /**
   * Get current rate limit status without making a request
   */
  getRateLimitStatus(): RateLimitHeaders {
    checkAndResetWindow()
    const remaining = Math.max(0, RATE_LIMIT_CONFIG.limit - rateLimitState.count)
    const resetTime = rateLimitState.windowStart + RATE_LIMIT_CONFIG.windowMs

    return {
      'X-RateLimit-Limit': RATE_LIMIT_CONFIG.limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.floor(resetTime / 1000).toString(),
    }
  },

  /**
   * Check if currently rate limited
   */
  isRateLimited,

  /**
   * Get seconds until rate limit resets
   */
  getRetryAfter,

  /**
   * Fetch clients with rate limiting
   */
  async getClients(workspaceId: string): Promise<ApiResponse<any[]>> {
    return apiRequest(async () => {
      const result = await supabase
        .from('clients')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      return { data: result.data, error: result.error as Error | null }
    })
  },

  /**
   * Fetch a single client with rate limiting
   */
  async getClient(clientId: string): Promise<ApiResponse<any>> {
    return apiRequest(async () => {
      const result = await supabase.from('clients').select('*').eq('id', clientId).single()
      return { data: result.data, error: result.error as Error | null }
    })
  },

  /**
   * Fetch projects with rate limiting
   */
  async getProjects(clientId?: string): Promise<ApiResponse<any[]>> {
    return apiRequest(async () => {
      let query = supabase.from('projects').select('*')
      if (clientId) {
        query = query.eq('client_id', clientId)
      }
      const result = await query.order('created_at', { ascending: false })
      return { data: result.data, error: result.error as Error | null }
    })
  },

  /**
   * Fetch activities with rate limiting
   */
  async getActivities(clientId: string, limit = 10): Promise<ApiResponse<any[]>> {
    return apiRequest(async () => {
      const result = await supabase
        .from('activities')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit)
      return { data: result.data, error: result.error as Error | null }
    })
  },

  /**
   * Generic query wrapper
   */
  async query<T>(queryFn: () => Promise<{ data: T | null; error: Error | null }>): Promise<ApiResponse<T>> {
    return apiRequest(queryFn)
  },
}

// Export rate limit config for testing
export const RATE_LIMIT = RATE_LIMIT_CONFIG

export default api

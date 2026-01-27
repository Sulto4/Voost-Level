/**
 * Webhook Service
 *
 * Handles triggering webhooks when events occur in the application.
 * This service fetches configured webhooks and fires them client-side.
 *
 * Note: In a production environment, webhooks should be triggered server-side
 * (via Supabase Edge Functions or database triggers) for security and reliability.
 * This client-side implementation is for demonstration/testing purposes.
 */

import { supabase } from '../lib/supabase'
import type { Webhook, Client, Project, Activity } from '../types/database'

export type WebhookEvent =
  | 'client.created'
  | 'client.updated'
  | 'client.deleted'
  | 'client.status_changed'
  | 'project.created'
  | 'project.updated'
  | 'project.completed'
  | 'activity.created'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: {
    client?: Partial<Client>
    project?: Partial<Project>
    activity?: Partial<Activity>
    previous?: Record<string, unknown>
    changes?: Record<string, unknown>
  }
}

export interface WebhookDelivery {
  webhookId: string
  webhookName: string
  url: string
  event: WebhookEvent
  payload: WebhookPayload
  status: 'success' | 'failed' | 'pending'
  statusCode?: number
  response?: string
  error?: string
  timestamp: string
  retryCount?: number
  maxRetries?: number
}

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000 // 1 second
const MAX_RETRY_DELAY_MS = 10000 // 10 seconds

// Store recent webhook deliveries for debugging/viewing
const recentDeliveries: WebhookDelivery[] = []
const MAX_DELIVERIES = 50

/**
 * Trigger webhooks for a specific event
 */
export async function triggerWebhooks(
  workspaceId: string,
  event: WebhookEvent,
  data: WebhookPayload['data']
): Promise<WebhookDelivery[]> {
  // Fetch active webhooks for this workspace that are subscribed to this event
  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .contains('events', [event])

  if (error || !webhooks || webhooks.length === 0) {
    return []
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  const deliveries: WebhookDelivery[] = []

  // Fire all matching webhooks
  for (const webhook of webhooks) {
    const delivery = await fireWebhook(webhook, event, payload)
    deliveries.push(delivery)

    // Store in recent deliveries
    recentDeliveries.unshift(delivery)
    if (recentDeliveries.length > MAX_DELIVERIES) {
      recentDeliveries.pop()
    }
  }

  return deliveries
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt)
  const cappedDelay = Math.min(exponentialDelay, MAX_RETRY_DELAY_MS)
  // Add jitter (±25%)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1)
  return Math.round(cappedDelay + jitter)
}

/**
 * Fire a single webhook with retry logic
 */
async function fireWebhook(
  webhook: Webhook,
  event: WebhookEvent,
  payload: WebhookPayload
): Promise<WebhookDelivery> {
  const delivery: WebhookDelivery = {
    webhookId: webhook.id,
    webhookName: webhook.name,
    url: webhook.url,
    event,
    payload,
    status: 'pending',
    timestamp: new Date().toISOString(),
    retryCount: 0,
    maxRetries: MAX_RETRIES,
  }

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'X-Webhook-Timestamp': payload.timestamp,
  }

  // Add signature if secret is configured
  if (webhook.secret) {
    const signature = await generateSignature(JSON.stringify(payload), webhook.secret)
    headers['X-Webhook-Signature'] = signature
  }

  // Attempt to fire webhook with retries
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    delivery.retryCount = attempt

    try {
      // Make the webhook request
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          ...headers,
          'X-Webhook-Retry-Count': String(attempt),
        },
        body: JSON.stringify(payload),
        // Short timeout to avoid blocking
        signal: AbortSignal.timeout(10000),
      })

      delivery.statusCode = response.status
      delivery.status = response.ok ? 'success' : 'failed'

      try {
        delivery.response = await response.text()
      } catch {
        delivery.response = 'Unable to read response body'
      }

      // If successful, break out of retry loop
      if (response.ok) {
        console.log(`[Webhook] SUCCESS: ${event} -> ${webhook.url}${attempt > 0 ? ` (after ${attempt} retries)` : ''}`, delivery)
        return delivery
      }

      // Log retry attempt for non-success status codes
      if (attempt < MAX_RETRIES) {
        const delay = calculateRetryDelay(attempt)
        console.log(`[Webhook] RETRY ${attempt + 1}/${MAX_RETRIES}: ${event} -> ${webhook.url} (status ${response.status}, waiting ${delay}ms)`)
        await sleep(delay)
      }
    } catch (err) {
      delivery.status = 'failed'
      delivery.error = err instanceof Error ? err.message : 'Unknown error'

      // Log retry attempt for network errors
      if (attempt < MAX_RETRIES) {
        const delay = calculateRetryDelay(attempt)
        console.log(`[Webhook] RETRY ${attempt + 1}/${MAX_RETRIES}: ${event} -> ${webhook.url} (error: ${delivery.error}, waiting ${delay}ms)`)
        await sleep(delay)
      }
    }
  }

  // Log final failure after all retries exhausted
  console.log(`[Webhook] FAILED: ${event} -> ${webhook.url} (after ${MAX_RETRIES} retries)`, delivery)

  return delivery
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const payloadData = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, payloadData)
  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return `sha256=${hashHex}`
}

/**
 * Get recent webhook deliveries
 */
export function getRecentDeliveries(): WebhookDelivery[] {
  return [...recentDeliveries]
}

/**
 * Clear recent deliveries
 */
export function clearRecentDeliveries(): void {
  recentDeliveries.length = 0
}

/**
 * Convenience functions for common events
 */
export const webhookEvents = {
  async clientCreated(workspaceId: string, client: Partial<Client>) {
    return triggerWebhooks(workspaceId, 'client.created', { client })
  },

  async clientUpdated(workspaceId: string, client: Partial<Client>, previous?: Partial<Client>) {
    return triggerWebhooks(workspaceId, 'client.updated', {
      client,
      previous,
      changes: getChanges(previous, client),
    })
  },

  async clientDeleted(workspaceId: string, client: Partial<Client>) {
    return triggerWebhooks(workspaceId, 'client.deleted', { client })
  },

  async clientStatusChanged(workspaceId: string, client: Partial<Client>, previousStatus: string) {
    return triggerWebhooks(workspaceId, 'client.status_changed', {
      client,
      previous: { status: previousStatus },
    })
  },

  async projectCreated(workspaceId: string, project: Partial<Project>) {
    return triggerWebhooks(workspaceId, 'project.created', { project })
  },

  async projectUpdated(workspaceId: string, project: Partial<Project>, previous?: Partial<Project>) {
    return triggerWebhooks(workspaceId, 'project.updated', {
      project,
      previous,
      changes: getChanges(previous, project),
    })
  },

  async projectCompleted(workspaceId: string, project: Partial<Project>) {
    return triggerWebhooks(workspaceId, 'project.completed', { project })
  },

  async activityCreated(workspaceId: string, activity: Partial<Activity>) {
    return triggerWebhooks(workspaceId, 'activity.created', { activity })
  },
}

/**
 * Helper to compute changes between two objects
 */
function getChanges(
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown> | undefined
): Record<string, { from: unknown; to: unknown }> {
  if (!previous || !current) return {}

  const changes: Record<string, { from: unknown; to: unknown }> = {}

  for (const key of Object.keys(current)) {
    if (previous[key] !== current[key]) {
      changes[key] = { from: previous[key], to: current[key] }
    }
  }

  return changes
}

export default webhookEvents

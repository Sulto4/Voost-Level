import type { Client, LeadScoringConfig, LeadScoringRule } from '../types/database'

export interface LeadScoreResult {
  score: number
  maxScore: number
  percentage: number
  breakdown: {
    rule: LeadScoringRule
    matched: boolean
    points: number
  }[]
}

/**
 * Calculate lead score for a client based on scoring rules
 */
export function calculateLeadScore(
  client: Client,
  config: LeadScoringConfig | null | undefined,
  options?: {
    hasProjects?: boolean
    hasRecentActivity?: boolean
  }
): LeadScoreResult {
  const result: LeadScoreResult = {
    score: 0,
    maxScore: 0,
    percentage: 0,
    breakdown: [],
  }

  if (!config?.enabled || !config.rules) {
    return result
  }

  const enabledRules = config.rules.filter(r => r.enabled)
  result.maxScore = enabledRules.reduce((sum, r) => sum + r.points, 0)

  for (const rule of enabledRules) {
    const matched = evaluateRule(rule, client, options)
    const points = matched ? rule.points : 0

    result.breakdown.push({
      rule,
      matched,
      points,
    })

    result.score += points
  }

  result.percentage = result.maxScore > 0
    ? Math.round((result.score / result.maxScore) * 100)
    : 0

  return result
}

/**
 * Evaluate if a single rule matches the client
 */
function evaluateRule(
  rule: LeadScoringRule,
  client: Client,
  options?: {
    hasProjects?: boolean
    hasRecentActivity?: boolean
  }
): boolean {
  switch (rule.type) {
    case 'has_email':
      return !!client.email && client.email.trim().length > 0

    case 'has_phone':
      return !!client.phone && client.phone.trim().length > 0

    case 'has_company':
      return !!client.company && client.company.trim().length > 0

    case 'has_website':
      return !!client.website && client.website.trim().length > 0

    case 'has_value':
      return client.value !== null && client.value > 0

    case 'value_above':
      if (!rule.value) return false
      const threshold = typeof rule.value === 'string' ? parseFloat(rule.value) : rule.value
      return client.value !== null && client.value >= threshold

    case 'source_equals':
      if (!rule.value) return false
      return client.source?.toLowerCase() === String(rule.value).toLowerCase()

    case 'has_projects':
      return options?.hasProjects === true

    case 'recent_activity':
      return options?.hasRecentActivity === true

    default:
      return false
  }
}

/**
 * Get a color class based on score percentage
 */
export function getScoreColor(percentage: number): string {
  if (percentage >= 80) return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
  if (percentage >= 60) return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30'
  if (percentage >= 40) return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30'
  if (percentage >= 20) return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30'
  return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
}

/**
 * Get a label based on score percentage
 */
export function getScoreLabel(percentage: number): string {
  if (percentage >= 80) return 'Hot'
  if (percentage >= 60) return 'Warm'
  if (percentage >= 40) return 'Cool'
  if (percentage >= 20) return 'Cold'
  return 'Ice'
}

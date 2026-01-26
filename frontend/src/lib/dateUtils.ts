/**
 * Convert a date to a relative timestamp string
 * e.g., "just now", "5 minutes ago", "2 hours ago", "Yesterday", etc.
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = typeof date === 'string' ? new Date(date) : date
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  // Just now (within last minute)
  if (diffInSeconds < 60) {
    return 'just now'
  }

  // Minutes ago
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`
  }

  // Hours ago
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`
  }

  // Days ago
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays === 1) {
    return 'Yesterday'
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`
  }

  // Weeks ago
  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`
  }

  // Months ago
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`
  }

  // Years ago
  const diffInYears = Math.floor(diffInDays / 365)
  return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`
}

/**
 * Format a date with both relative time and absolute time
 * Returns object with both formats for flexible display
 */
export function formatDateTime(date: Date | string): { relative: string; absolute: string } {
  const then = typeof date === 'string' ? new Date(date) : date

  return {
    relative: formatRelativeTime(date),
    absolute: then.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  }
}

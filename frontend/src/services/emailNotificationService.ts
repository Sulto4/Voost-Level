/**
 * Email Notification Service
 *
 * In development mode, this logs emails to the console instead of sending them.
 * In production, this would integrate with an email service like SendGrid, Mailgun, etc.
 */

export interface EmailNotification {
  to: string
  subject: string
  body: string
  type: 'project_added' | 'project_removed' | 'task_assigned' | 'workspace_invite' | 'client_assigned' | 'general'
}

export interface NotificationPreferences {
  emailNotificationsEnabled: boolean
  inAppNotificationsEnabled: boolean
  notifyOnProjectAdded: boolean
  notifyOnTaskAssigned: boolean
  notifyOnWorkspaceInvite: boolean
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNotificationsEnabled: true,
  inAppNotificationsEnabled: true,
  notifyOnProjectAdded: true,
  notifyOnTaskAssigned: true,
  notifyOnWorkspaceInvite: true,
}

/**
 * Get notification preferences from localStorage
 */
export function getNotificationPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem('notificationPreferences')
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.error('[EmailNotificationService] Error loading preferences:', e)
  }
  return DEFAULT_PREFERENCES
}

/**
 * Save notification preferences to localStorage
 */
export function saveNotificationPreferences(prefs: Partial<NotificationPreferences>): NotificationPreferences {
  const current = getNotificationPreferences()
  const updated = { ...current, ...prefs }
  localStorage.setItem('notificationPreferences', JSON.stringify(updated))
  console.log('[EmailNotificationService] Preferences updated:', updated)
  return updated
}

/**
 * Send an email notification (logs to console in development)
 */
export function sendEmailNotification(notification: EmailNotification): boolean {
  const prefs = getNotificationPreferences()

  if (!prefs.emailNotificationsEnabled) {
    console.log('[EmailNotificationService] Email notifications disabled, skipping:', notification.type)
    return false
  }

  // Check specific notification type preferences
  switch (notification.type) {
    case 'project_added':
    case 'project_removed':
      if (!prefs.notifyOnProjectAdded) {
        console.log('[EmailNotificationService] Project notifications disabled, skipping')
        return false
      }
      break
    case 'task_assigned':
      if (!prefs.notifyOnTaskAssigned) {
        console.log('[EmailNotificationService] Task notifications disabled, skipping')
        return false
      }
      break
    case 'workspace_invite':
      if (!prefs.notifyOnWorkspaceInvite) {
        console.log('[EmailNotificationService] Workspace invite notifications disabled, skipping')
        return false
      }
      break
  }

  // In development, log to console instead of sending actual email
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('📧 EMAIL NOTIFICATION SENT')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`To:      ${notification.to}`)
  console.log(`Subject: ${notification.subject}`)
  console.log('───────────────────────────────────────────────────────────────')
  console.log(notification.body)
  console.log('═══════════════════════════════════════════════════════════════')

  return true
}

/**
 * Send notification when user is added to a project
 */
export function notifyProjectAdded(userEmail: string, projectName: string, addedByName: string): boolean {
  return sendEmailNotification({
    to: userEmail,
    subject: `You've been added to project: ${projectName}`,
    body: `Hi there!\n\n${addedByName} has added you to the project "${projectName}" on Voost Level.\n\nYou can now access this project and contribute to its tasks and milestones.\n\nLog in to Voost Level to get started.\n\nBest regards,\nThe Voost Level Team`,
    type: 'project_added',
  })
}

/**
 * Send notification when user is assigned to a task
 */
export function notifyTaskAssigned(userEmail: string, taskTitle: string, projectName: string, assignedByName: string): boolean {
  return sendEmailNotification({
    to: userEmail,
    subject: `New task assigned: ${taskTitle}`,
    body: `Hi there!\n\n${assignedByName} has assigned you a new task:\n\nTask: ${taskTitle}\nProject: ${projectName}\n\nLog in to Voost Level to view the task details and get started.\n\nBest regards,\nThe Voost Level Team`,
    type: 'task_assigned',
  })
}

/**
 * Send notification when user is invited to a workspace
 */
export function notifyWorkspaceInvite(userEmail: string, workspaceName: string, invitedByName: string, role: string): boolean {
  return sendEmailNotification({
    to: userEmail,
    subject: `You've been invited to ${workspaceName}`,
    body: `Hi there!\n\n${invitedByName} has invited you to join the "${workspaceName}" workspace on Voost Level as a ${role}.\n\nLog in or sign up to accept the invitation and start collaborating.\n\nBest regards,\nThe Voost Level Team`,
    type: 'workspace_invite',
  })
}

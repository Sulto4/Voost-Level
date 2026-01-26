import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Phone, Mail, MessageSquare, Users, CheckSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { ActivityType } from '../../types/database'

interface LogActivityModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  onActivityLogged?: () => void
  defaultType?: ActivityType
}

const activityTypes: { type: ActivityType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'call', label: 'Call', icon: Phone },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'meeting', label: 'Meeting', icon: Users },
  { type: 'note', label: 'Note', icon: MessageSquare },
  { type: 'task', label: 'Task', icon: CheckSquare },
]

export function LogActivityModal({ isOpen, onClose, clientId, onActivityLogged, defaultType = 'call' }: LogActivityModalProps) {
  const { user } = useAuth()

  const [activityType, setActivityType] = useState<ActivityType>(defaultType)
  const [content, setContent] = useState('')
  const [duration, setDuration] = useState('')
  const [outcome, setOutcome] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!content.trim()) {
      setError('Please add some notes about this activity')
      return
    }

    if (!user) {
      setError('You must be logged in')
      return
    }

    setLoading(true)

    // Build metadata based on activity type
    const metadata: Record<string, unknown> = {}
    if (activityType === 'call' && duration) {
      metadata.duration = duration
    }
    if (outcome) {
      metadata.outcome = outcome
    }

    const { error: insertError } = await supabase
      .from('activities')
      .insert({
        client_id: clientId,
        user_id: user.id,
        type: activityType,
        content: content.trim(),
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })

    if (insertError) {
      setError(insertError.message || 'Failed to log activity')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      onActivityLogged?.()
      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 1500)
    }
  }

  function handleClose() {
    setActivityType(defaultType)
    setContent('')
    setDuration('')
    setOutcome('')
    setError('')
    setSuccess(false)
    onClose()
  }

  const selectedActivity = activityTypes.find(a => a.type === activityType)

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Log Activity" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm">
            Activity logged successfully!
          </div>
        )}

        {/* Activity Type Selection */}
        <div>
          <label className="label">Activity Type</label>
          <div className="flex flex-wrap gap-2">
            {activityTypes.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setActivityType(type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  activityType === type
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                disabled={success}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration field for calls */}
        {activityType === 'call' && (
          <div>
            <label htmlFor="duration" className="label">
              Call Duration
            </label>
            <input
              id="duration"
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="input"
              placeholder="e.g., 15 minutes"
              disabled={success}
            />
          </div>
        )}

        {/* Outcome field */}
        {(activityType === 'call' || activityType === 'meeting') && (
          <div>
            <label htmlFor="outcome" className="label">
              Outcome
            </label>
            <select
              id="outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="input"
              disabled={success}
            >
              <option value="">Select outcome...</option>
              <option value="positive">Positive - Interested</option>
              <option value="neutral">Neutral - Follow up needed</option>
              <option value="negative">Negative - Not interested</option>
              <option value="no_answer">No Answer</option>
              <option value="left_message">Left Message</option>
            </select>
          </div>
        )}

        {/* Notes/Content */}
        <div>
          <label htmlFor="content" className="label">
            {activityType === 'note' ? 'Note' : 'Notes'} *
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input min-h-[120px]"
            placeholder={
              activityType === 'call' ? 'What did you discuss on the call?' :
              activityType === 'email' ? 'Summary of the email...' :
              activityType === 'meeting' ? 'Meeting notes and action items...' :
              activityType === 'task' ? 'Task details...' :
              'Add your note here...'
            }
            disabled={success}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="btn-outline"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center"
            disabled={loading || success}
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                {selectedActivity && <selectedActivity.icon className="h-4 w-4 mr-2" />}
                Log {selectedActivity?.label || 'Activity'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

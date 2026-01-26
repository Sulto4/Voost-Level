import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useWorkspace } from '../../context/WorkspaceContext'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { WorkspaceRole } from '../../types/database'

interface InviteMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onInviteSent?: () => void
}

export function InviteMemberModal({ isOpen, onClose, onInviteSent }: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('member')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { inviteMember } = useWorkspace()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    const { error } = await inviteMember(email.trim(), role)

    if (error) {
      setError(error.message || 'Failed to send invitation')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      onInviteSent?.()
      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 2000)
    }
  }

  function handleClose() {
    setEmail('')
    setRole('member')
    setError('')
    setSuccess(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite Team Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm">
            Invitation sent successfully!
          </div>
        )}

        <div>
          <label htmlFor="memberEmail" className="label">
            Email Address
          </label>
          <input
            id="memberEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="colleague@example.com"
            autoFocus
            disabled={success}
          />
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            They'll receive an email invitation to join your workspace
          </p>
        </div>

        <div>
          <label htmlFor="memberRole" className="label">
            Role
          </label>
          <select
            id="memberRole"
            value={role}
            onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            className="input"
            disabled={success}
          >
            <option value="admin">Admin - Can manage team, clients, and projects</option>
            <option value="member">Member - Can create and edit clients and projects</option>
            <option value="viewer">Viewer - Read-only access</option>
          </select>
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
            {loading ? <LoadingSpinner size="sm" /> : 'Send Invitation'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

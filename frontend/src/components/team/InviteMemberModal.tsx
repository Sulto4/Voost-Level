import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { notifyWorkspaceInvite } from '../../services/emailNotificationService'
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
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const { inviteMember, pendingInvitations, currentWorkspace } = useWorkspace()
  const { profile } = useAuth()

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
      // Send email notification for workspace invite
      if (currentWorkspace) {
        const inviterName = profile?.full_name || profile?.email || 'Someone'
        const roleName = role === 'admin' ? 'Admin' : role === 'member' ? 'Member' : 'Viewer'
        notifyWorkspaceInvite(email.trim(), currentWorkspace.name, inviterName, roleName)
      }

      setSuccess(true)
      setLoading(false)
      onInviteSent?.()
      // Find the newly created invitation to get the link
      // We need to wait a bit for the state to update
      setTimeout(() => {
        const newInvitation = pendingInvitations.find(
          (inv) => inv.email.toLowerCase() === email.trim().toLowerCase()
        )
        if (newInvitation?.token) {
          setInviteLink(`${window.location.origin}/invite/${newInvitation.token}`)
        }
      }, 500)
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  function handleClose() {
    setEmail('')
    setRole('member')
    setError('')
    setSuccess(false)
    setInviteLink('')
    setCopied(false)
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
            <p className="font-medium mb-2">Invitation created successfully!</p>
            {inviteLink && (
              <div className="mt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Share this invitation link:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="input text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="btn-outline p-2"
                    title="Copy link"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
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

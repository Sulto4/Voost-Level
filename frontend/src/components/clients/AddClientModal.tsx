import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import type { ClientStatus } from '../../types/database'

interface AddClientModalProps {
  isOpen: boolean
  onClose: () => void
  onClientAdded?: () => void
}

export function AddClientModal({ isOpen, onClose, onClientAdded }: AddClientModalProps) {
  const { currentWorkspace } = useWorkspace()
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<ClientStatus>('lead')
  const [value, setValue] = useState('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!name.trim()) {
      setError('Client name is required')
      return
    }

    if (!currentWorkspace || !user) {
      setError('No workspace selected')
      return
    }

    setLoading(true)

    const { error: insertError } = await supabase
      .from('clients')
      .insert({
        workspace_id: currentWorkspace.id,
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        status,
        value: value ? parseFloat(value) : null,
        source: source.trim() || null,
        notes: notes.trim() || null,
        created_by: user.id,
      })

    if (insertError) {
      setError(insertError.message || 'Failed to create client')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      onClientAdded?.()
      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 1500)
    }
  }

  function handleClose() {
    setName('')
    setCompany('')
    setEmail('')
    setPhone('')
    setStatus('lead')
    setValue('')
    setSource('')
    setNotes('')
    setError('')
    setSuccess(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Client" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm">
            Client created successfully!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="clientName" className="label">
              Client Name *
            </label>
            <input
              id="clientName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="John Smith"
              autoFocus
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="company" className="label">
              Company
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="input"
              placeholder="Acme Inc."
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="clientEmail" className="label">
              Email
            </label>
            <input
              id="clientEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="john@example.com"
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="+1 (555) 000-0000"
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="status" className="label">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ClientStatus)}
              className="input"
              disabled={success}
            >
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="churned">Churned</option>
            </select>
          </div>

          <div>
            <label htmlFor="value" className="label">
              Deal Value ($)
            </label>
            <input
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input"
              placeholder="10000"
              min="0"
              step="0.01"
              disabled={success}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="source" className="label">
              Lead Source
            </label>
            <input
              id="source"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="input"
              placeholder="Website, Referral, Social Media, etc."
              disabled={success}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notes" className="label">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Additional notes about this client..."
              disabled={success}
            />
          </div>
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
            {loading ? <LoadingSpinner size="sm" /> : 'Add Client'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

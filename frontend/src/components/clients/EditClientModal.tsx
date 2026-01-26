import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import type { Client, ClientStatus } from '../../types/database'

interface EditClientModalProps {
  isOpen: boolean
  onClose: () => void
  client: Client | null
  onClientUpdated?: () => void
}

export function EditClientModal({ isOpen, onClose, client, onClientUpdated }: EditClientModalProps) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<ClientStatus>('lead')
  const [value, setValue] = useState('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Populate form when client changes
  useEffect(() => {
    if (client) {
      setName(client.name || '')
      setCompany(client.company || '')
      setEmail(client.email || '')
      setPhone(client.phone || '')
      setWebsite(client.website || '')
      setStatus(client.status)
      setValue(client.value?.toString() || '')
      setSource(client.source || '')
      setNotes(client.notes || '')
    }
  }, [client])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!name.trim()) {
      setError('Client name is required')
      return
    }

    if (!client) {
      setError('No client to update')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        status,
        value: value ? parseFloat(value) : null,
        source: source.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)

    if (updateError) {
      setError(updateError.message || 'Failed to update client')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      onClientUpdated?.()
      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 1500)
    }
  }

  function handleClose() {
    setError('')
    setSuccess(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Client" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
            Client updated successfully!
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="editClientName" className="label">
              Client Name *
            </label>
            <input
              id="editClientName"
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
            <label htmlFor="editCompany" className="label">
              Company
            </label>
            <input
              id="editCompany"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="input"
              placeholder="Acme Inc."
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="editClientEmail" className="label">
              Email
            </label>
            <input
              id="editClientEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="john@example.com"
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="editPhone" className="label">
              Phone
            </label>
            <input
              id="editPhone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="+1 (555) 000-0000"
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="editWebsite" className="label">
              Website
            </label>
            <input
              id="editWebsite"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="input"
              placeholder="https://example.com"
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="editStatus" className="label">
              Status
            </label>
            <select
              id="editStatus"
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
            <label htmlFor="editValue" className="label">
              Deal Value ($)
            </label>
            <input
              id="editValue"
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

          <div>
            <label htmlFor="editSource" className="label">
              Lead Source
            </label>
            <input
              id="editSource"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="input"
              placeholder="Website, Referral, Social Media, etc."
              disabled={success}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="editNotes" className="label">
              Notes
            </label>
            <textarea
              id="editNotes"
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
            {loading ? <LoadingSpinner size="sm" /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

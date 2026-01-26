import { useState, useEffect, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import type { Client, ClientStatus } from '../../types/database'

interface CustomField {
  key: string
  value: string
}

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
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)

  // Track original values to detect changes
  const originalValues = useMemo(() => {
    if (!client) return null
    return {
      name: client.name || '',
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      website: client.website || '',
      status: client.status,
      value: client.value?.toString() || '',
      source: client.source || '',
      notes: client.notes || '',
      customFields: client.custom_fields && typeof client.custom_fields === 'object'
        ? Object.entries(client.custom_fields as Record<string, string>).map(
            ([key, value]) => ({ key, value: String(value) })
          )
        : [],
    }
  }, [client])

  // Check if form has unsaved changes
  const isDirty = useMemo(() => {
    if (!originalValues) return false
    if (name !== originalValues.name) return true
    if (company !== originalValues.company) return true
    if (email !== originalValues.email) return true
    if (phone !== originalValues.phone) return true
    if (website !== originalValues.website) return true
    if (status !== originalValues.status) return true
    if (value !== originalValues.value) return true
    if (source !== originalValues.source) return true
    if (notes !== originalValues.notes) return true
    if (customFields.length !== originalValues.customFields.length) return true
    for (let i = 0; i < customFields.length; i++) {
      if (customFields[i].key !== originalValues.customFields[i]?.key) return true
      if (customFields[i].value !== originalValues.customFields[i]?.value) return true
    }
    return false
  }, [name, company, email, phone, website, status, value, source, notes, customFields, originalValues])

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

      // Parse custom fields from JSONB
      if (client.custom_fields && typeof client.custom_fields === 'object') {
        const fields = Object.entries(client.custom_fields as Record<string, string>).map(
          ([key, value]) => ({ key, value: String(value) })
        )
        setCustomFields(fields.length > 0 ? fields : [])
      } else {
        setCustomFields([])
      }
    }
  }, [client])

  function addCustomField() {
    setCustomFields([...customFields, { key: '', value: '' }])
  }

  function removeCustomField(index: number) {
    setCustomFields(customFields.filter((_, i) => i !== index))
  }

  function updateCustomField(index: number, field: 'key' | 'value', value: string) {
    const updated = [...customFields]
    updated[index][field] = value
    setCustomFields(updated)
  }

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

    // Convert custom fields array to object
    const customFieldsObj: Record<string, string> = {}
    customFields.forEach(({ key, value }) => {
      if (key.trim()) {
        customFieldsObj[key.trim()] = value.trim()
      }
    })

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
        custom_fields: Object.keys(customFieldsObj).length > 0 ? customFieldsObj : null,
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
    setShowUnsavedWarning(false)
    onClose()
  }

  function attemptClose() {
    if (isDirty && !success) {
      setShowUnsavedWarning(true)
    } else {
      handleClose()
    }
  }

  function confirmClose() {
    setShowUnsavedWarning(false)
    handleClose()
  }

  function cancelClose() {
    setShowUnsavedWarning(false)
  }

  return (
    <>
    <Modal isOpen={isOpen} onClose={attemptClose} title="Edit Client" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm">
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

          {/* Custom Fields Section */}
          <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Custom Fields</label>
              <button
                type="button"
                onClick={addCustomField}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
                disabled={success}
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
            </div>

            {customFields.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                No custom fields. Click "Add Field" to create one.
              </p>
            ) : (
              <div className="space-y-3">
                {customFields.map((field, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={field.key}
                      onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                      className="input flex-1"
                      placeholder="Field name (e.g., Industry)"
                      disabled={success}
                    />
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                      className="input flex-1"
                      placeholder="Value (e.g., Technology)"
                      disabled={success}
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(index)}
                      className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                      disabled={success}
                      aria-label="Remove custom field"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={attemptClose}
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

    <ConfirmDialog
      isOpen={showUnsavedWarning}
      onClose={cancelClose}
      onConfirm={confirmClose}
      title="Unsaved Changes"
      message="You have unsaved changes. Are you sure you want to close? Your changes will be lost."
      confirmText="Leave"
      cancelText="Stay"
      variant="warning"
    />
    </>
  )
}

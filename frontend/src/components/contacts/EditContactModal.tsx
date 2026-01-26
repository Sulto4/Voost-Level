import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { ClientContact } from '../../types/database'

interface EditContactModalProps {
  isOpen: boolean
  onClose: () => void
  contact: ClientContact | null
  onContactUpdated?: () => void
}

export function EditContactModal({ isOpen, onClose, contact, onContactUpdated }: EditContactModalProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    is_primary: false,
    notes: '',
  })

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        role: contact.role || '',
        is_primary: contact.is_primary || false,
        notes: contact.notes || '',
      })
    }
  }, [contact])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Contact name is required')
      return
    }

    if (!contact) {
      toast.error('No contact selected')
      return
    }

    setLoading(true)

    // If setting this contact as primary, first unset any existing primary contact for this client
    if (formData.is_primary && !contact.is_primary) {
      const { error: unsetError } = await supabase
        .from('client_contacts')
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq('client_id', contact.client_id)
        .eq('is_primary', true)
        .neq('id', contact.id)

      if (unsetError) {
        console.error('Error unsetting previous primary contact:', unsetError)
        // Continue anyway, as we still want to update this contact
      }
    }

    const { error } = await supabase
      .from('client_contacts')
      .update({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        role: formData.role.trim() || null,
        is_primary: formData.is_primary,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id)

    setLoading(false)

    if (error) {
      console.error('Error updating contact:', error)
      toast.error('Failed to update contact')
    } else {
      toast.success('Contact updated successfully')
      onClose()
      onContactUpdated?.()
    }
  }

  function handleClose() {
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="editContactName" className="label">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="editContactName"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className="input"
            placeholder="John Smith"
            required
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="editContactEmail" className="label">
            Email
          </label>
          <input
            id="editContactEmail"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            className="input"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <label htmlFor="editContactPhone" className="label">
            Phone
          </label>
          <input
            id="editContactPhone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            className="input"
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <div>
          <label htmlFor="editContactRole" className="label">
            Role / Title
          </label>
          <input
            id="editContactRole"
            name="role"
            type="text"
            value={formData.role}
            onChange={handleChange}
            className="input"
            placeholder="CEO, CTO, Manager, etc."
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="editContactPrimary"
            name="is_primary"
            type="checkbox"
            checked={formData.is_primary}
            onChange={handleChange}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="editContactPrimary" className="text-sm text-slate-700 dark:text-slate-300">
            Primary Contact
          </label>
        </div>

        <div>
          <label htmlFor="editContactNotes" className="label">
            Notes
          </label>
          <textarea
            id="editContactNotes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="input"
            rows={3}
            placeholder="Additional notes about this contact..."
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
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useToast } from '../../context/ToastContext'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface AddContactModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  onContactAdded?: () => void
}

export function AddContactModal({ isOpen, onClose, clientId, onContactAdded }: AddContactModalProps) {
  const { currentWorkspace } = useWorkspace()
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

    if (!currentWorkspace) {
      toast.error('No workspace selected')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('client_contacts')
      .insert({
        client_id: clientId,
        workspace_id: currentWorkspace.id,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        role: formData.role.trim() || null,
        is_primary: formData.is_primary,
        notes: formData.notes.trim() || null,
      })

    setLoading(false)

    if (error) {
      console.error('Error adding contact:', error)
      toast.error('Failed to add contact')
    } else {
      toast.success('Contact added successfully')
      handleClose()
      onContactAdded?.()
    }
  }

  function handleClose() {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: '',
      is_primary: false,
      notes: '',
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="contactName" className="label">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="contactName"
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
          <label htmlFor="contactEmail" className="label">
            Email
          </label>
          <input
            id="contactEmail"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            className="input"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <label htmlFor="contactPhone" className="label">
            Phone
          </label>
          <input
            id="contactPhone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            className="input"
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <div>
          <label htmlFor="contactRole" className="label">
            Role / Title
          </label>
          <input
            id="contactRole"
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
            id="contactPrimary"
            name="is_primary"
            type="checkbox"
            checked={formData.is_primary}
            onChange={handleChange}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="contactPrimary" className="text-sm text-slate-700 dark:text-slate-300">
            Primary Contact
          </label>
        </div>

        <div>
          <label htmlFor="contactNotes" className="label">
            Notes
          </label>
          <textarea
            id="contactNotes"
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
            {loading ? <LoadingSpinner size="sm" /> : 'Add Contact'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

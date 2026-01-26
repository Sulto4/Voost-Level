import { useState, useEffect } from 'react'
import { Plus, X, RotateCcw, Save, AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { MultiSelect } from '../ui/MultiSelect'
import { RichTextEditor } from '../ui/RichTextEditor'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useFormDraft } from '../../hooks/useFormDraft'
import type { ClientStatus } from '../../types/database'

// Predefined tag options for clients
const TAG_OPTIONS = [
  { value: 'vip', label: 'VIP' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'startup', label: 'Startup' },
  { value: 'smb', label: 'SMB' },
  { value: 'priority', label: 'Priority' },
  { value: 'potential', label: 'High Potential' },
  { value: 'partner', label: 'Partner' },
  { value: 'referral-source', label: 'Referral Source' },
]

interface CustomField {
  key: string
  value: string
}

interface ClientFormData {
  name: string
  company: string
  email: string
  phone: string
  website: string
  status: ClientStatus
  value: string
  source: string
  notes: string
  tags: string[]
  customFields: CustomField[]
}

const initialFormData: ClientFormData = {
  name: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  status: 'lead',
  value: '',
  source: '',
  notes: '',
  tags: [],
  customFields: [],
}

/**
 * Validates phone number format
 * Accepts: digits, spaces, dashes, parentheses, plus sign, and dots
 * Requires at least 7 digits for a valid phone number
 */
function isValidPhone(phone: string): boolean {
  if (!phone.trim()) return true // Empty is valid (optional field)

  // Remove all valid phone characters and check if only digits remain
  const digitsOnly = phone.replace(/[\s\-\(\)\+\.]/g, '')

  // Must be only digits after removing formatting characters
  if (!/^\d+$/.test(digitsOnly)) {
    return false
  }

  // Must have at least 7 digits (minimum for a phone number)
  return digitsOnly.length >= 7
}

/**
 * Formats/cleans a phone number
 * Removes invalid characters but preserves standard formatting
 */
function cleanPhoneNumber(phone: string): string {
  // Keep only valid phone characters
  return phone.replace(/[^\d\s\-\(\)\+\.]/g, '').trim()
}

/**
 * Validates URL format
 * Accepts URLs with or without protocol
 * Returns true for valid URLs, false for invalid ones
 */
function isValidUrl(url: string): boolean {
  if (!url.trim()) return true // Empty is valid (optional field)

  // Add protocol if missing for validation
  let urlToTest = url.trim()
  if (!urlToTest.match(/^https?:\/\//i)) {
    urlToTest = 'https://' + urlToTest
  }

  try {
    const parsed = new URL(urlToTest)
    // Must have a valid hostname with at least one dot (e.g., example.com)
    return parsed.hostname.includes('.') && parsed.hostname.length > 3
  } catch {
    return false
  }
}

/**
 * Normalizes a URL by adding https:// if no protocol is present
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''

  // If already has a protocol, return as-is
  if (trimmed.match(/^https?:\/\//i)) {
    return trimmed
  }

  // Add https:// prefix
  return 'https://' + trimmed
}

interface AddClientModalProps {
  isOpen: boolean
  onClose: () => void
  onClientAdded?: () => void
}

export function AddClientModal({ isOpen, onClose, onClientAdded }: AddClientModalProps) {
  const { currentWorkspace } = useWorkspace()
  const { user } = useAuth()
  const { success: showSuccess, error: showError } = useToast()

  // Use form draft hook for auto-save functionality
  const {
    data: formData,
    setData: setFormData,
    hasDraft,
    clearDraft,
    dismissDraftNotice,
    resetForm,
    justSaved,
  } = useFormDraft<ClientFormData>({
    storageKey: `add-client-${currentWorkspace?.id || 'default'}`,
    initialData: initialFormData,
    debounceMs: 1000,
    enabled: isOpen, // Only save when modal is open
  })

  // Destructure form data for easier access
  const { name, company, email, phone, website, status, value, source, notes, tags, customFields } = formData

  // Helper to update a single field
  const updateField = <K extends keyof ClientFormData>(field: K, fieldValue: ClientFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: fieldValue }))
  }

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function addCustomField() {
    updateField('customFields', [...customFields, { key: '', value: '' }])
  }

  function removeCustomField(index: number) {
    updateField('customFields', customFields.filter((_, i) => i !== index))
  }

  function updateCustomField(index: number, field: 'key' | 'value', fieldValue: string) {
    const updated = [...customFields]
    updated[index][field] = fieldValue
    updateField('customFields', updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!name.trim()) {
      setError('Client name is required')
      return
    }

    // Validate phone number format
    if (phone.trim() && !isValidPhone(phone)) {
      setError('Please enter a valid phone number (e.g., +1 555-123-4567)')
      return
    }

    // Validate URL format
    if (website.trim() && !isValidUrl(website)) {
      setError('Please enter a valid website URL (e.g., example.com or https://example.com)')
      return
    }

    if (!currentWorkspace || !user) {
      setError('No workspace selected')
      return
    }

    setLoading(true)

    // Convert custom fields array to object and include tags
    const customFieldsObj: Record<string, string | string[]> = {}
    customFields.forEach(({ key, value }) => {
      if (key.trim()) {
        customFieldsObj[key.trim()] = value.trim()
      }
    })
    // Add tags to custom fields if any selected
    if (tags.length > 0) {
      customFieldsObj['tags'] = tags
    }

    const { error: insertError } = await supabase
      .from('clients')
      .insert({
        workspace_id: currentWorkspace.id,
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() ? cleanPhoneNumber(phone) : null,
        website: website.trim() ? normalizeUrl(website) : null,
        status,
        value: value ? parseFloat(value) : null,
        source: source.trim() || null,
        notes: notes.trim() || null,
        custom_fields: Object.keys(customFieldsObj).length > 0 ? customFieldsObj : null,
        created_by: user.id,
      })

    if (insertError) {
      // Detect specific error types
      const errorMsg = insertError.message?.toLowerCase() || ''
      let userMessage: string
      if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('failed to fetch')) {
        userMessage = 'Network error. Please check your internet connection and try again.'
      } else if (errorMsg.includes('timeout')) {
        userMessage = 'Request timed out. Please try again.'
      } else if (errorMsg.includes('duplicate') || errorMsg.includes('unique') || errorMsg.includes('already exists')) {
        userMessage = 'A client with this email already exists. Please use a different email address or find the existing client.'
      } else if (errorMsg.includes('violates')) {
        userMessage = 'This data conflicts with an existing record. Please check for duplicates.'
      } else {
        userMessage = insertError.message || 'Failed to create client'
      }
      setError(userMessage)
      showError(userMessage)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      showSuccess(`Client "${name.trim()}" created successfully!`)
      onClientAdded?.()
      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 1500)
    }
  }

  function handleReset() {
    resetForm()
    setError('')
  }

  function handleClose() {
    // On successful submit, clear the draft
    if (success) {
      clearDraft()
    }
    // Don't reset form data here - let the draft persist in localStorage
    // The form will be populated from draft when reopened
    setError('')
    setSuccess(false)
    dismissDraftNotice()
    onClose()
  }

  // Clear draft after successful submission
  useEffect(() => {
    if (success) {
      clearDraft()
    }
  }, [success, clearDraft])

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

        {/* Draft restored notification */}
        {hasDraft && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                Draft restored
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Your previous unsaved data has been restored.
                <button
                  type="button"
                  onClick={handleReset}
                  className="ml-1 underline hover:no-underline"
                >
                  Clear draft
                </button>
              </p>
            </div>
            <button
              type="button"
              onClick={dismissDraftNotice}
              className="p-1 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
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
              onChange={(e) => updateField('name', e.target.value)}
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
              onChange={(e) => updateField('company', e.target.value)}
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
              onChange={(e) => updateField('email', e.target.value)}
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
              onChange={(e) => updateField('phone', e.target.value)}
              className="input"
              placeholder="+1 (555) 000-0000"
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="website" className="label">
              Website
            </label>
            <input
              id="website"
              type="text"
              value={website}
              onChange={(e) => updateField('website', e.target.value)}
              className="input"
              placeholder="example.com"
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
              onChange={(e) => updateField('status', e.target.value as ClientStatus)}
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
              onChange={(e) => updateField('value', e.target.value)}
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
              onChange={(e) => updateField('source', e.target.value)}
              className="input"
              placeholder="Website, Referral, Social Media, etc."
              disabled={success}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">
              Tags
            </label>
            <MultiSelect
              options={TAG_OPTIONS}
              selected={tags}
              onChange={(selected) => updateField('tags', selected)}
              placeholder="Select client tags..."
              disabled={success}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notes" className="label">
              Notes
            </label>
            <RichTextEditor
              value={notes}
              onChange={(value) => updateField('notes', value)}
              placeholder="Additional notes about this client..."
              disabled={success}
              minHeight="80px"
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

        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          {/* Auto-save indicator */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            {justSaved && (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Draft saved</span>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="btn-outline flex items-center"
              disabled={loading || success}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </button>
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
        </div>
      </form>
    </Modal>
  )
}

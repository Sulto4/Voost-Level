import { useState, useRef } from 'react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import type { ClientStatus } from '../../types/database'

interface ImportClientsModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete?: () => void
}

interface ParsedClient {
  name: string
  company?: string
  email?: string
  phone?: string
  status: ClientStatus
  value?: number
  source?: string
  website?: string
  notes?: string
}

interface ImportPreview {
  valid: ParsedClient[]
  duplicates: ParsedClient[]
  errors: { row: number; error: string }[]
}

const VALID_STATUSES: ClientStatus[] = ['lead', 'active', 'inactive', 'churned']

export function ImportClientsModal({ isOpen, onClose, onImportComplete }: ImportClientsModalProps) {
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)

  function parseCSV(text: string): string[][] {
    const lines = text.trim().split('\n')
    return lines.map(line => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    })
  }

  function parseClientsFromCSV(csvData: string[][]): ImportPreview {
    const valid: ParsedClient[] = []
    const duplicates: ParsedClient[] = []
    const errors: { row: number; error: string }[] = []
    const seenEmails = new Set<string>()

    // Skip header row
    const headers = csvData[0]?.map(h => h.toLowerCase().trim())
    if (!headers) {
      return { valid: [], duplicates: [], errors: [{ row: 1, error: 'Empty file' }] }
    }

    // Find column indices
    const nameIndex = headers.findIndex(h => h === 'name' || h === 'client name' || h === 'client')
    const companyIndex = headers.findIndex(h => h === 'company' || h === 'company name')
    const emailIndex = headers.findIndex(h => h === 'email' || h === 'email address')
    const phoneIndex = headers.findIndex(h => h === 'phone' || h === 'phone number' || h === 'telephone')
    const statusIndex = headers.findIndex(h => h === 'status')
    const valueIndex = headers.findIndex(h => h === 'value' || h === 'deal value' || h === 'amount')
    const sourceIndex = headers.findIndex(h => h === 'source' || h === 'lead source')
    const websiteIndex = headers.findIndex(h => h === 'website' || h === 'url' || h === 'web')
    const notesIndex = headers.findIndex(h => h === 'notes' || h === 'note' || h === 'comments')

    if (nameIndex === -1) {
      return { valid: [], duplicates: [], errors: [{ row: 1, error: 'Missing required "Name" column' }] }
    }

    // Process data rows
    for (let i = 1; i < csvData.length; i++) {
      const row = csvData[i]
      if (!row || row.length === 0 || (row.length === 1 && !row[0])) {
        continue // Skip empty rows
      }

      const name = row[nameIndex]?.trim()
      if (!name) {
        errors.push({ row: i + 1, error: 'Missing name' })
        continue
      }

      const statusValue = row[statusIndex]?.toLowerCase().trim()
      let status: ClientStatus = 'lead'
      if (statusValue) {
        if (VALID_STATUSES.includes(statusValue as ClientStatus)) {
          status = statusValue as ClientStatus
        } else {
          errors.push({ row: i + 1, error: `Invalid status "${statusValue}" - defaulting to "lead"` })
        }
      }

      const valueStr = valueIndex >= 0 ? row[valueIndex]?.replace(/[$,]/g, '').trim() : ''
      const value = valueStr ? parseFloat(valueStr) : undefined

      const email = emailIndex >= 0 ? row[emailIndex]?.trim() || undefined : undefined

      const client: ParsedClient = {
        name,
        company: companyIndex >= 0 ? row[companyIndex]?.trim() || undefined : undefined,
        email,
        phone: phoneIndex >= 0 ? row[phoneIndex]?.trim() || undefined : undefined,
        status,
        value: value && !isNaN(value) ? value : undefined,
        source: sourceIndex >= 0 ? row[sourceIndex]?.trim() || undefined : undefined,
        website: websiteIndex >= 0 ? row[websiteIndex]?.trim() || undefined : undefined,
        notes: notesIndex >= 0 ? row[notesIndex]?.trim() || undefined : undefined,
      }

      // Check for duplicate emails within the file
      if (email) {
        const emailLower = email.toLowerCase()
        if (seenEmails.has(emailLower)) {
          duplicates.push(client)
          errors.push({ row: i + 1, error: `Duplicate email "${email}" in file - will be skipped` })
          continue
        }
        seenEmails.add(emailLower)
      }

      valid.push(client)
    }

    return { valid, duplicates, errors }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError('')
    setPreview(null)
    setSuccess(false)

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    setFile(selectedFile)
    setLoading(true)

    try {
      const text = await selectedFile.text()
      const csvData = parseCSV(text)
      const parsedPreview = parseClientsFromCSV(csvData)

      // Check for existing clients in database by email
      if (currentWorkspace && parsedPreview.valid.length > 0) {
        const emailsToCheck = parsedPreview.valid
          .filter(c => c.email)
          .map(c => c.email!.toLowerCase())

        if (emailsToCheck.length > 0) {
          const { data: existingClients } = await supabase
            .from('clients')
            .select('email')
            .eq('workspace_id', currentWorkspace.id)
            .in('email', emailsToCheck)

          if (existingClients && existingClients.length > 0) {
            const existingEmails = new Set(existingClients.map(c => c.email?.toLowerCase()))

            // Move duplicates from valid to duplicates
            const newValid: ParsedClient[] = []
            for (const client of parsedPreview.valid) {
              if (client.email && existingEmails.has(client.email.toLowerCase())) {
                parsedPreview.duplicates.push(client)
                parsedPreview.errors.push({
                  row: 0,
                  error: `Email "${client.email}" already exists in database - will be skipped`
                })
              } else {
                newValid.push(client)
              }
            }
            parsedPreview.valid = newValid
          }
        }
      }

      setPreview(parsedPreview)
    } catch (err) {
      setError('Failed to parse CSV file')
    }

    setLoading(false)
  }

  async function handleImport() {
    if (!preview || preview.valid.length === 0 || !user || !currentWorkspace) {
      return
    }

    setImporting(true)
    setError('')

    const clientsToInsert = preview.valid.map(client => ({
      workspace_id: currentWorkspace.id,
      created_by: user.id,
      name: client.name,
      company: client.company || null,
      email: client.email || null,
      phone: client.phone || null,
      status: client.status,
      value: client.value || null,
      source: client.source || null,
      website: client.website || null,
      notes: client.notes || null,
    }))

    const { data, error: insertError } = await supabase
      .from('clients')
      .insert(clientsToInsert)
      .select()

    if (insertError) {
      setError(insertError.message || 'Failed to import clients')
      setImporting(false)
      return
    }

    setImportedCount(data?.length || preview.valid.length)
    setSkippedCount(preview.duplicates.length)
    setSuccess(true)
    setImporting(false)
    onImportComplete?.()

    // Auto-close after success
    setTimeout(() => {
      handleClose()
    }, 2000)
  }

  function handleClose() {
    setFile(null)
    setPreview(null)
    setError('')
    setSuccess(false)
    setImportedCount(0)
    setSkippedCount(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Clients" size="lg">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            Successfully imported {importedCount} clients!
            {skippedCount > 0 && ` (${skippedCount} duplicates skipped)`}
          </div>
        )}

        {/* File Upload Area */}
        {!preview && !loading && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-slate-400">CSV file only</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-medium">Expected columns:</p>
              <p>Name (required), Company, Email, Phone, Status, Value, Source, Website, Notes</p>
              <p className="text-xs">Status values: lead, active, inactive, churned</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-slate-500 dark:text-slate-400">Parsing CSV file...</p>
          </div>
        )}

        {/* Preview */}
        {preview && !success && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-slate-600 dark:text-slate-300">
                <FileText className="h-5 w-5 mr-2" />
                <span>{file?.name}</span>
              </div>
              <button
                onClick={() => {
                  setFile(null)
                  setPreview(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Choose different file
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{preview.valid.length}</p>
                <p className="text-sm text-green-700 dark:text-green-400">New records</p>
              </div>
              {preview.duplicates.length > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{preview.duplicates.length}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">Duplicates (skipped)</p>
                </div>
              )}
              {preview.errors.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{preview.errors.length}</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">Warnings</p>
                </div>
              )}
            </div>

            {/* Preview Table */}
            {preview.valid.length > 0 && (
              <div className="max-h-64 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {preview.valid.slice(0, 10).map((client, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{client.name}</td>
                        <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{client.company || '-'}</td>
                        <td className="px-4 py-2">
                          <span className="capitalize text-slate-600 dark:text-slate-300">{client.status}</span>
                        </td>
                        <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                          {client.value ? `$${client.value.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.valid.length > 10 && (
                  <div className="px-4 py-2 text-sm text-slate-500 bg-slate-50 dark:bg-slate-800">
                    ...and {preview.valid.length - 10} more records
                  </div>
                )}
              </div>
            )}

            {/* Errors */}
            {preview.errors.length > 0 && (
              <div className="max-h-32 overflow-auto bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">Warnings:</p>
                {preview.errors.map((err, idx) => (
                  <p key={idx} className="text-sm text-yellow-700 dark:text-yellow-400">
                    Row {err.row}: {err.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={handleClose}
            className="btn-outline"
            disabled={importing}
          >
            Cancel
          </button>
          {preview && preview.valid.length > 0 && !success && (
            <button
              onClick={handleImport}
              className="btn-primary flex items-center"
              disabled={importing}
            >
              {importing ? <LoadingSpinner size="sm" /> : `Import ${preview.valid.length} Clients`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

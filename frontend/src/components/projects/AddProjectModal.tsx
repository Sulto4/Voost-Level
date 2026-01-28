import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import type { ProjectStatus, Client } from '../../types/database'

interface AddProjectModalProps {
  isOpen: boolean
  onClose: () => void
  client?: Client | null
  onProjectAdded?: () => void
}

export function AddProjectModal({ isOpen, onClose, client, onProjectAdded }: AddProjectModalProps) {
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [budget, setBudget] = useState('')
  const [codePath, setCodePath] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Fetch clients when modal opens and no client is pre-selected
  useEffect(() => {
    if (isOpen && !client && currentWorkspace) {
      fetchClients()
    }
  }, [isOpen, client, currentWorkspace])

  async function fetchClients() {
    if (!currentWorkspace) return
    setLoadingClients(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .is('deleted_at', null)
      .order('name')

    if (!error && data) {
      setClients(data)
    }
    setLoadingClients(false)
  }

  // Get the active client (either prop or selected from dropdown)
  const activeClient = client || clients.find(c => c.id === selectedClientId) || null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    if (!activeClient || !user) {
      setError('No client selected')
      return
    }

    // Validate date range
    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      setError('Start date cannot be after due date')
      return
    }

    setLoading(true)

    const { error: insertError } = await supabase
      .from('projects')
      .insert({
        client_id: activeClient.id,
        name: name.trim(),
        description: description.trim() || null,
        status,
        start_date: startDate || null,
        due_date: dueDate || null,
        budget: budget ? parseFloat(budget) : null,
        code_path: codePath.trim() || null,
        created_by: user.id,
      })

    if (insertError) {
      setError(insertError.message || 'Failed to create project')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      onProjectAdded?.()
      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 1500)
    }
  }

  function handleClose() {
    setName('')
    setDescription('')
    setStatus('planning')
    setStartDate('')
    setDueDate('')
    setBudget('')
    setCodePath('')
    setSelectedClientId('')
    setError('')
    setSuccess(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Project" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm">
            Project created successfully!
          </div>
        )}

        {client ? (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-sm text-slate-500 dark:text-slate-400">Creating project for</p>
            <p className="font-medium text-slate-900 dark:text-white">{client.name}</p>
          </div>
        ) : (
          <div>
            <label htmlFor="clientSelect" className="label">
              Client *
            </label>
            {loadingClients ? (
              <div className="input flex items-center text-slate-400">
                <LoadingSpinner size="sm" />
                <span className="ml-2">Loading clients...</span>
              </div>
            ) : (
              <select
                id="clientSelect"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="input"
                disabled={success}
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.company ? ` (${c.company})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="projectName" className="label">
              Project Name *
            </label>
            <input
              id="projectName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Website Redesign"
              autoFocus
              disabled={success}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Project description..."
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
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="input"
              disabled={success}
            >
              <option value="planning">Planning</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label htmlFor="budget" className="label">
              Budget ($)
            </label>
            <input
              id="budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="input"
              placeholder="10000"
              min="0"
              step="0.01"
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="startDate" className="label">
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
              disabled={success}
            />
          </div>

          <div>
            <label htmlFor="dueDate" className="label">
              Due Date
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input"
              disabled={success}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="codePath" className="label">
              Code Path
            </label>
            <input
              id="codePath"
              type="text"
              value={codePath}
              onChange={(e) => setCodePath(e.target.value)}
              className="input font-mono text-sm"
              placeholder="E:\Projects\client-website"
              disabled={success}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Local path to project source code (for AI agent context)
            </p>
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
            {loading ? <LoadingSpinner size="sm" /> : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

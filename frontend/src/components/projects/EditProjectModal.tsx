import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import type { Project, ProjectStatus } from '../../types/database'

interface EditProjectModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project | null
  onProjectUpdated?: () => void
}

export function EditProjectModal({ isOpen, onClose, project, onProjectUpdated }: EditProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [budget, setBudget] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Populate form when project changes
  useEffect(() => {
    if (project) {
      setName(project.name || '')
      setDescription(project.description || '')
      setStatus(project.status || 'planning')
      setStartDate(project.start_date || '')
      setDueDate(project.due_date || '')
      setBudget(project.budget?.toString() || '')
    }
  }, [project])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    if (!project) {
      setError('No project selected')
      return
    }

    // Validate date range
    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      setError('Start date cannot be after due date')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        status,
        start_date: startDate || null,
        due_date: dueDate || null,
        budget: budget ? parseFloat(budget) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id)

    if (updateError) {
      setError(updateError.message || 'Failed to update project')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      onProjectUpdated?.()
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Project" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm">
            Project updated successfully!
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

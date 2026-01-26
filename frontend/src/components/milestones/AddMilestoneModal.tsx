import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'

interface AddMilestoneModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  onMilestoneAdded?: () => void
}

export function AddMilestoneModal({ isOpen, onClose, projectId, projectName, onMilestoneAdded }: AddMilestoneModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Milestone name is required')
      return
    }

    setLoading(true)

    const { error: insertError } = await supabase
      .from('milestones')
      .insert({
        project_id: projectId,
        name: name.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        completed: false,
      })

    if (insertError) {
      setError(insertError.message || 'Failed to create milestone')
      setLoading(false)
    } else {
      setLoading(false)
      onMilestoneAdded?.()
      handleClose()
    }
  }

  function handleClose() {
    setName('')
    setDescription('')
    setDueDate('')
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Milestone" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400">Adding milestone to</p>
          <p className="font-medium text-slate-900 dark:text-white">{projectName}</p>
        </div>

        <div>
          <label htmlFor="name" className="label">
            Milestone Name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Phase 1 Complete"
          />
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[80px]"
            placeholder="Milestone description..."
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
            className="btn-primary"
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Create Milestone'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useWorkspace } from '../../context/WorkspaceContext'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface CreateWorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { createWorkspace } = useWorkspace()

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Workspace name is required')
      return
    }

    if (name.length < 3) {
      setError('Workspace name must be at least 3 characters')
      return
    }

    setLoading(true)
    const { error } = await createWorkspace(name.trim(), slug)

    if (error) {
      setError(error.message || 'Failed to create workspace')
      setLoading(false)
    } else {
      setName('')
      setLoading(false)
      onClose()
    }
  }

  function handleClose() {
    setName('')
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Workspace">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="workspaceName" className="label">
            Workspace Name
          </label>
          <input
            id="workspaceName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="My Agency"
            autoFocus
          />
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This will be displayed throughout the app
          </p>
        </div>

        <div>
          <label className="label">Workspace URL</label>
          <div className="input bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            voostlevel.com/{slug || 'your-workspace'}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Auto-generated from the workspace name
          </p>
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
            {loading ? <LoadingSpinner size="sm" /> : 'Create Workspace'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import type { TaskStatus, TaskPriority, Project } from '../../types/database'

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  project: Project | null
  onTaskAdded?: () => void
}

export function AddTaskModal({ isOpen, onClose, project, onTaskAdded }: AddTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!title.trim()) {
      setError('Task title is required')
      return
    }

    if (!project) {
      setError('No project selected')
      return
    }

    setLoading(true)

    const { error: insertError } = await supabase
      .from('tasks')
      .insert({
        project_id: project.id,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: dueDate || null,
      })

    if (insertError) {
      setError(insertError.message || 'Failed to create task')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      onTaskAdded?.()
      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 1500)
    }
  }

  function handleClose() {
    setTitle('')
    setDescription('')
    setStatus('todo')
    setPriority('medium')
    setDueDate('')
    setError('')
    setSuccess(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Task" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
            Task created successfully!
          </div>
        )}

        {project && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-sm text-slate-500 dark:text-slate-400">Adding task to</p>
            <p className="font-medium text-slate-900 dark:text-white">{project.name}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="taskTitle" className="label">
              Task Title *
            </label>
            <input
              id="taskTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Complete wireframes"
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
              placeholder="Task description..."
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
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="input"
              disabled={success}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label htmlFor="priority" className="label">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="input"
              disabled={success}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
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
            {loading ? <LoadingSpinner size="sm" /> : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

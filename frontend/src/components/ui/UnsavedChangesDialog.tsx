import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  onStay: () => void
  onLeave: () => void
  title?: string
  message?: string
}

export function UnsavedChangesDialog({
  isOpen,
  onStay,
  onLeave,
  title = 'Unsaved Changes',
  message = 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
}: UnsavedChangesDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onStay} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 pt-1">
            {message}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button onClick={onStay} className="btn-primary">
            Stay
          </button>
          <button onClick={onLeave} className="btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            Leave
          </button>
        </div>
      </div>
    </Modal>
  )
}

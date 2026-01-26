import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, FolderKanban, X } from 'lucide-react'
import { clsx } from 'clsx'

interface QuickAddMenuProps {
  onAddClient: () => void
}

export function QuickAddMenu({ onAddClient }: QuickAddMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full btn-primary flex items-center justify-center',
          isOpen && 'ring-2 ring-primary-300 dark:ring-primary-600'
        )}
      >
        {isOpen ? (
          <X className="h-5 w-5 mr-2" />
        ) : (
          <Plus className="h-5 w-5 mr-2" />
        )}
        Quick Add
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden animate-fade-in">
          <div className="py-1">
            <button
              onClick={() => {
                onAddClient()
                setIsOpen(false)
              }}
              className="w-full flex items-center px-4 py-3 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Users className="h-5 w-5 mr-3 text-primary-500" />
              <div>
                <div className="font-medium">Add Client</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Create a new client or lead</div>
              </div>
            </button>
            <button
              onClick={() => {
                navigate('/projects')
                setIsOpen(false)
              }}
              className="w-full flex items-center px-4 py-3 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FolderKanban className="h-5 w-5 mr-3 text-green-500" />
              <div>
                <div className="font-medium">Add Project</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Go to projects page</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

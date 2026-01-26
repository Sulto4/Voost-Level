import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  Users,
  Kanban,
  FolderKanban,
  UserCog,
  Settings,
  Plus,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface Command {
  id: string
  name: string
  description?: string
  icon: React.ReactNode
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const commands: Command[] = [
    {
      id: 'dashboard',
      name: 'Go to Dashboard',
      description: 'View your dashboard overview',
      icon: <LayoutDashboard className="h-5 w-5" />,
      action: () => { navigate('/dashboard'); onClose() },
      keywords: ['home', 'overview', 'main'],
    },
    {
      id: 'clients',
      name: 'Go to Clients',
      description: 'Manage your clients and leads',
      icon: <Users className="h-5 w-5" />,
      action: () => { navigate('/clients'); onClose() },
      keywords: ['customers', 'leads', 'contacts'],
    },
    {
      id: 'pipeline',
      name: 'Go to Pipeline',
      description: 'View your sales pipeline',
      icon: <Kanban className="h-5 w-5" />,
      action: () => { navigate('/pipeline'); onClose() },
      keywords: ['sales', 'deals', 'kanban'],
    },
    {
      id: 'projects',
      name: 'Go to Projects',
      description: 'Manage your projects',
      icon: <FolderKanban className="h-5 w-5" />,
      action: () => { navigate('/projects'); onClose() },
      keywords: ['work', 'tasks'],
    },
    {
      id: 'team',
      name: 'Go to Team',
      description: 'Manage team members',
      icon: <UserCog className="h-5 w-5" />,
      action: () => { navigate('/team'); onClose() },
      keywords: ['members', 'users', 'people'],
    },
    {
      id: 'settings',
      name: 'Go to Settings',
      description: 'Configure your account',
      icon: <Settings className="h-5 w-5" />,
      action: () => { navigate('/settings'); onClose() },
      keywords: ['preferences', 'account', 'profile'],
    },
    {
      id: 'add-client',
      name: 'Add New Client',
      description: 'Create a new client record',
      icon: <Plus className="h-5 w-5" />,
      action: () => { navigate('/clients?action=add'); onClose() },
      keywords: ['create', 'new', 'customer'],
    },
    {
      id: 'toggle-theme',
      name: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      description: 'Toggle between light and dark themes',
      icon: theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />,
      action: () => { toggleTheme(); onClose() },
      keywords: ['theme', 'dark', 'light', 'mode', 'appearance'],
    },
  ]

  // Filter commands based on query
  const filteredCommands = commands.filter((command) => {
    if (!query) return true
    const searchText = query.toLowerCase()
    return (
      command.name.toLowerCase().includes(searchText) ||
      command.description?.toLowerCase().includes(searchText) ||
      command.keywords?.some((keyword) => keyword.includes(searchText))
    )
  })

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      // Use setTimeout to ensure the modal is rendered before focusing
      setTimeout(() => {
        inputRef.current?.focus()
      }, 10)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [filteredCommands, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Command Palette */}
      <div
        className="fixed inset-0 z-50 overflow-y-auto pt-[15vh]"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex justify-center px-4">
          <div
            className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400 text-sm"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 rounded">
                ESC
              </kbd>
            </div>

            {/* Commands List */}
            <div
              ref={listRef}
              className="max-h-[300px] overflow-y-auto py-2"
              role="listbox"
            >
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No commands found for "{query}"
                </div>
              ) : (
                filteredCommands.map((command, index) => (
                  <button
                    key={command.id}
                    onClick={command.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                    role="option"
                    aria-selected={index === selectedIndex}
                  >
                    <span className={`${
                      index === selectedIndex
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {command.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{command.name}</div>
                      {command.description && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {command.description}
                        </div>
                      )}
                    </div>
                    {index === selectedIndex && (
                      <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 rounded">
                        Enter
                      </kbd>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">↓</kbd>
                <span>to navigate</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">Enter</kbd>
                <span>to select</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Hook to manage command palette state and global keyboard shortcut
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  }
}

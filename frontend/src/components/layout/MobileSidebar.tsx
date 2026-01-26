import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Users,
  Kanban,
  FolderKanban,
  UserCog,
  Settings,
  X,
  Plus,
  ChevronDown,
  Check,
  Building2,
} from 'lucide-react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { useState } from 'react'
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Pipeline', href: '/pipeline', icon: Kanban },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Team', href: '/team', icon: UserCog },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface MobileSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspace()
  const { profile } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-50 lg:hidden animate-slide-in">
        <div className="flex flex-col h-full">
          {/* Close button */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <span className="text-lg font-semibold text-slate-900 dark:text-white">Menu</span>
            <button
              onClick={onClose}
              className="icon-btn"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Workspace Selector */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] text-left text-sm font-medium text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <span className="truncate">
                  {currentWorkspace?.name || 'Select Workspace'}
                </span>
                <ChevronDown className={clsx(
                  'h-4 w-4 text-slate-500 transition-transform',
                  isDropdownOpen && 'rotate-180'
                )} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
                  {/* Workspace List */}
                  {workspaces.length > 0 && (
                    <div className="py-1">
                      {workspaces.map((workspace) => (
                        <button
                          key={workspace.id}
                          onClick={() => {
                            selectWorkspace(workspace.id)
                            setIsDropdownOpen(false)
                          }}
                          className={clsx(
                            'w-full flex items-center px-3 py-2.5 min-h-[44px] text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors',
                            workspace.id === currentWorkspace?.id
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-slate-700 dark:text-slate-300'
                          )}
                        >
                          <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="truncate flex-1">{workspace.name}</span>
                          {workspace.id === currentWorkspace?.id && (
                            <Check className="h-4 w-4 flex-shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  {workspaces.length > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-700" />
                  )}

                  {/* Create Workspace */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false)
                        setIsCreateModalOpen(true)
                      }}
                      className="w-full flex items-center px-3 py-2.5 min-h-[44px] text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Workspace
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center px-3 py-2.5 min-h-[44px] text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )
                }
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {profile?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </>
  )
}

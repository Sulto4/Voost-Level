import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Users,
  Kanban,
  FolderKanban,
  UserCog,
  Settings,
  Plus,
  ChevronDown,
  Check,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal'
import { QuickAddMenu } from '../quick-add/QuickAddMenu'
import { AddClientModal } from '../clients/AddClientModal'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, minRole: 'viewer' as const },
  { name: 'Clients', href: '/clients', icon: Users, minRole: 'viewer' as const },
  { name: 'Pipeline', href: '/pipeline', icon: Kanban, minRole: 'viewer' as const },
  { name: 'Projects', href: '/projects', icon: FolderKanban, minRole: 'viewer' as const },
  { name: 'Team', href: '/team', icon: UserCog, minRole: 'member' as const },
  { name: 'Settings', href: '/settings', icon: Settings, minRole: 'viewer' as const },
]

// Role hierarchy for menu visibility
const roleLevel: Record<string, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

export function Sidebar() {
  const { workspaces, currentWorkspace, currentRole, selectWorkspace } = useWorkspace()
  const { profile } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed')
    return saved === 'true'
  })
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed))
  }, [isCollapsed])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <aside className={clsx(
        "hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300",
        isCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <div className="flex flex-col flex-grow bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
          {/* Workspace Selector */}
          <div className={clsx("border-b border-slate-200 dark:border-slate-700", isCollapsed ? "p-2" : "p-4")}>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={clsx(
                  "w-full flex items-center text-left text-sm font-medium text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors",
                  isCollapsed ? "justify-center px-2 py-2.5 min-h-[44px]" : "justify-between px-3 py-2.5 min-h-[44px]"
                )}
                title={isCollapsed ? currentWorkspace?.name || 'Select Workspace' : undefined}
              >
                <div className={clsx("flex items-center", isCollapsed ? "" : "min-w-0 flex-1")}>
                  {currentWorkspace?.logo_url ? (
                    <img
                      src={currentWorkspace.logo_url}
                      alt={currentWorkspace.name}
                      className={clsx("rounded object-cover flex-shrink-0", isCollapsed ? "h-6 w-6" : "h-6 w-6 mr-2")}
                    />
                  ) : (
                    <Building2 className={clsx("flex-shrink-0 text-slate-500", isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-2")} />
                  )}
                  {!isCollapsed && (
                    <span className="truncate">
                      {currentWorkspace?.name || 'Select Workspace'}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <ChevronDown className={clsx(
                    'h-4 w-4 text-slate-500 transition-transform flex-shrink-0',
                    isDropdownOpen && 'rotate-180'
                  )} />
                )}
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
                          {workspace.logo_url ? (
                            <img
                              src={workspace.logo_url}
                              alt={workspace.name}
                              className="h-5 w-5 rounded object-cover mr-2 flex-shrink-0"
                            />
                          ) : (
                            <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
                          )}
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
          <nav className={clsx("flex-1 py-4 space-y-1", isCollapsed ? "px-2" : "px-2")}>
            {navigation
              .filter((item) => {
                const userRoleLevel = currentRole ? roleLevel[currentRole] || 0 : 0
                const requiredLevel = roleLevel[item.minRole] || 0
                return userRoleLevel >= requiredLevel
              })
              .map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center min-h-[44px] text-sm font-medium rounded-lg transition-colors',
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )
                }
              >
                <item.icon className={clsx("h-5 w-5", !isCollapsed && "mr-3")} />
                {!isCollapsed && item.name}
              </NavLink>
            ))}
          </nav>

          {/* Quick Add Button */}
          {!isCollapsed && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <QuickAddMenu
                onAddClient={() => setIsAddClientModalOpen(true)}
              />
            </div>
          )}

          {/* User Profile */}
          <div className={clsx("border-t border-slate-200 dark:border-slate-700", isCollapsed ? "p-2" : "p-4")}>
            <div className={clsx("flex items-center", isCollapsed && "justify-center")}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'User avatar'}
                  className="h-8 w-8 rounded-full object-cover"
                  title={isCollapsed ? profile?.full_name || profile?.email || 'User' : undefined}
                />
              ) : (
                <div
                  className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium"
                  title={isCollapsed ? profile?.full_name || profile?.email || 'User' : undefined}
                >
                  {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              {!isCollapsed && (
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {profile?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {profile?.email}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Collapse Toggle Button */}
          <div className={clsx("border-t border-slate-200 dark:border-slate-700", isCollapsed ? "p-2" : "p-4")}>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={clsx(
                "flex items-center min-h-[44px] text-sm font-medium rounded-lg transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700",
                isCollapsed ? "w-full justify-center px-2 py-2.5" : "w-full px-3 py-2.5"
              )}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <>
                  <PanelLeftClose className="h-5 w-5 mr-3" />
                  Collapse
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
      />
    </>
  )
}

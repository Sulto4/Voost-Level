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
} from 'lucide-react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Pipeline', href: '/pipeline', icon: Kanban },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Team', href: '/team', icon: UserCog },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspace()
  const { profile } = useAuth()

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
        {/* Workspace Selector */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <button className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              <span className="truncate">
                {currentWorkspace?.name || 'Select Workspace'}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
            {/* Dropdown menu would go here */}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
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

        {/* Quick Add Button */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <button className="w-full btn-primary flex items-center justify-center">
            <Plus className="h-5 w-5 mr-2" />
            Quick Add
          </button>
        </div>

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
  )
}

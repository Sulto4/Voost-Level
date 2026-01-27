import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Bell, Sun, Moon, Menu, LogOut, User, Settings, Users, FolderKanban, X, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { supabase } from '../../lib/supabase'
import type { Client, Project, Task } from '../../types/database'

interface OverdueTask extends Task {
  project_name?: string
  client_name?: string
  project_id: string
}

interface Notification {
  id: string
  type: 'overdue_task' | 'due_soon' | 'info'
  title: string
  subtitle?: string
  timestamp: Date
  read: boolean
  link?: string
}

interface SearchResult {
  type: 'client' | 'project'
  id: string
  name: string
  subtitle?: string
}

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { currentWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set())
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set())

  // Load read and dismissed notifications from localStorage
  useEffect(() => {
    const storedRead = localStorage.getItem('readNotifications')
    if (storedRead) {
      try {
        const parsed = JSON.parse(storedRead)
        setReadNotificationIds(new Set(parsed))
      } catch (e) {
        localStorage.removeItem('readNotifications')
      }
    }

    const storedDismissed = localStorage.getItem('dismissedNotifications')
    if (storedDismissed) {
      try {
        const parsed = JSON.parse(storedDismissed)
        // Only keep dismissals from the last 24 hours
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
        const validDismissals = parsed.filter((d: { id: string; time: number }) => d.time > oneDayAgo)
        setDismissedNotificationIds(new Set(validDismissals.map((d: { id: string }) => d.id)))
        localStorage.setItem('dismissedNotifications', JSON.stringify(validDismissals))
      } catch (e) {
        localStorage.removeItem('dismissedNotifications')
      }
    }
  }, [])

  // Save read notifications to localStorage
  const markNotificationAsRead = (notificationId: string) => {
    setReadNotificationIds(prev => {
      const newSet = new Set(prev)
      newSet.add(notificationId)
      localStorage.setItem('readNotifications', JSON.stringify([...newSet]))
      return newSet
    })
  }

  // Mark all as read
  const markAllNotificationsAsRead = () => {
    const allIds = notifications.map(n => n.id)
    setReadNotificationIds(new Set(allIds))
    localStorage.setItem('readNotifications', JSON.stringify(allIds))
  }

  // Dismiss a single notification (hide for 24 hours)
  const dismissNotification = (notificationId: string) => {
    setDismissedNotificationIds(prev => {
      const newSet = new Set(prev)
      newSet.add(notificationId)
      const storedDismissed = localStorage.getItem('dismissedNotifications')
      let dismissals: { id: string; time: number }[] = []
      if (storedDismissed) {
        try {
          dismissals = JSON.parse(storedDismissed)
        } catch (e) {
          // ignore
        }
      }
      dismissals.push({ id: notificationId, time: Date.now() })
      localStorage.setItem('dismissedNotifications', JSON.stringify(dismissals))
      return newSet
    })
  }

  // Clear all notifications (dismiss all for 24 hours)
  const clearAllNotifications = () => {
    const allIds = notifications.map(n => n.id)
    setDismissedNotificationIds(new Set(allIds))
    const dismissals = allIds.map(id => ({ id, time: Date.now() }))
    localStorage.setItem('dismissedNotifications', JSON.stringify(dismissals))
  }

  // Filter out dismissed notifications
  const visibleNotifications = notifications.filter(n => !dismissedNotificationIds.has(n.id))

  // Get unread count (only from visible notifications)
  const unreadCount = visibleNotifications.filter(n => !readNotificationIds.has(n.id)).length

  // Fetch overdue tasks for notifications
  const fetchOverdueTasks = async () => {
    if (!currentWorkspace) return

    setNotificationsLoading(true)

    // Get all clients for this workspace
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .eq('workspace_id', currentWorkspace!.id)

    if (!clients || clients.length === 0) {
      setNotifications([])
      setNotificationsLoading(false)
      return
    }

    const clientIds = clients.map(c => c.id)

    // Get all projects for these clients
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, client_id, clients!inner(name)')
      .in('client_id', clientIds)

    if (!projects || projects.length === 0) {
      setNotifications([])
      setNotificationsLoading(false)
      return
    }

    const projectIds = projects.map(p => p.id)
    const projectMap = new Map(projects.map(p => [p.id, { name: p.name, client_name: (p.clients as any)?.name }]))

    // Get overdue and upcoming tasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const dayAfterTomorrow = new Date(today)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0]

    // Get overdue tasks (due_date is before today and status is not 'done')
    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('*')
      .in('project_id', projectIds)
      .lt('due_date', todayStr)
      .neq('status', 'done')
      .order('due_date', { ascending: true })
      .limit(10)

    // Get tasks due today or tomorrow (reminders)
    const { data: upcomingTasks } = await supabase
      .from('tasks')
      .select('*')
      .in('project_id', projectIds)
      .gte('due_date', todayStr)
      .lt('due_date', dayAfterTomorrowStr)
      .neq('status', 'done')
      .order('due_date', { ascending: true })
      .limit(10)

    const newNotifications: Notification[] = []

    // Add overdue task notifications
    if (overdueTasks && overdueTasks.length > 0) {
      overdueTasks.forEach(task => {
        const projectInfo = projectMap.get(task.project_id)
        const dueDate = new Date(task.due_date!)
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

        newNotifications.push({
          id: `overdue-${task.id}`,
          type: 'overdue_task' as const,
          title: `Task "${task.title}" is overdue`,
          subtitle: `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue • ${projectInfo?.name || 'Unknown Project'}`,
          timestamp: dueDate,
          read: false,
          link: `/projects/${task.project_id}`,
        })
      })
    }

    // Add upcoming task reminders (due today or tomorrow)
    if (upcomingTasks && upcomingTasks.length > 0) {
      upcomingTasks.forEach(task => {
        const projectInfo = projectMap.get(task.project_id)
        const dueDate = new Date(task.due_date!)
        const isDueToday = task.due_date === todayStr
        const dueDateLabel = isDueToday ? 'Due today' : 'Due tomorrow'

        newNotifications.push({
          id: `upcoming-${task.id}`,
          type: 'due_soon' as const,
          title: `${dueDateLabel}: "${task.title}"`,
          subtitle: `${projectInfo?.name || 'Unknown Project'}`,
          timestamp: dueDate,
          read: false,
          link: `/projects/${task.project_id}`,
        })
      })
    }

    setNotifications(newNotifications)

    setNotificationsLoading(false)
  }

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (!currentWorkspace) return

    fetchOverdueTasks()

    // Refresh notifications every 5 minutes
    const interval = setInterval(fetchOverdueTasks, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [currentWorkspace])

  // Refetch when notifications panel is opened
  useEffect(() => {
    if (showNotifications && currentWorkspace) {
      fetchOverdueTasks()
    }
  }, [showNotifications])

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !currentWorkspace) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const results: SearchResult[] = []

      // Search clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, company')
        .eq('workspace_id', currentWorkspace.id)
        .ilike('name', `%${searchQuery}%`)
        .limit(5)

      if (clients) {
        results.push(...clients.map(client => ({
          type: 'client' as const,
          id: client.id,
          name: client.name,
          subtitle: client.company || undefined,
        })))
      }

      // Search projects - need to join through clients to filter by workspace
      const { data: clientsForProjects } = await supabase
        .from('clients')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)

      if (clientsForProjects && clientsForProjects.length > 0) {
        const clientIds = clientsForProjects.map(c => c.id)
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, clients!inner(name)')
          .in('client_id', clientIds)
          .ilike('name', `%${searchQuery}%`)
          .limit(5)

        if (projects) {
          results.push(...projects.map(project => ({
            type: 'project' as const,
            id: project.id,
            name: project.name,
            subtitle: (project.clients as any)?.name || undefined,
          })))
        }
      }

      setSearchResults(results)
      setShowSearchResults(true)
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, currentWorkspace])

  function handleResultClick(result: SearchResult) {
    if (result.type === 'client') {
      navigate(`/clients/${result.id}`)
    } else {
      navigate(`/projects/${result.id}`)
    }
    setSearchQuery('')
    setShowSearchResults(false)
  }

  function clearSearch() {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden icon-btn"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-lg mx-4" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="search"
              placeholder="Search clients, projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowSearchResults(true)}
              className="input pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-96 overflow-y-auto z-50 animate-fade-in">
                {isSearching ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mx-auto mb-2"></div>
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                    <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No results found for "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleResultClick(result)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                      >
                        <div className={`p-2 rounded-lg ${
                          result.type === 'client'
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : 'bg-purple-100 dark:bg-purple-900/30'
                        }`}>
                          {result.type === 'client' ? (
                            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <FolderKanban className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {result.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {result.type === 'client' ? 'Client' : 'Project'}
                            {result.subtitle && ` • ${result.subtitle}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="icon-btn"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications)
                setShowUserMenu(false)
              }}
              className="icon-btn relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 animate-fade-in">
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                        {unreadCount} unread
                      </span>
                    )}
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
                      <p className="text-sm">Loading notifications...</p>
                    </div>
                  ) : visibleNotifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-70" />
                      <p className="text-sm">No notifications</p>
                      <p className="text-xs mt-1">You're all caught up!</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {visibleNotifications.map((notification) => {
                        const isRead = readNotificationIds.has(notification.id)
                        return (
                          <button
                            key={notification.id}
                            onClick={() => {
                              markNotificationAsRead(notification.id)
                              if (notification.link) {
                                navigate(notification.link)
                                setShowNotifications(false)
                              }
                            }}
                            className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${
                              !isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                            }`}
                          >
                            <div className={`p-2 rounded-lg flex-shrink-0 relative ${
                              notification.type === 'overdue_task'
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : 'bg-amber-100 dark:bg-amber-900/30'
                            }`}>
                              {notification.type === 'overdue_task' ? (
                                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                              ) : (
                                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              )}
                              {!isRead && (
                                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-blue-500 rounded-full" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${!isRead ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {notification.subtitle}
                              </p>
                            </div>
                            <Clock className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                {visibleNotifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <button
                      onClick={() => {
                        navigate('/projects')
                        setShowNotifications(false)
                      }}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      View all projects
                    </button>
                    <button
                      onClick={clearAllNotifications}
                      className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu)
                setShowNotifications(false)
              }}
              className="flex items-center space-x-2 min-w-[44px] min-h-[44px] p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'User avatar'}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                  {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 animate-fade-in">
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    navigate('/settings?tab=profile')
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <User className="h-4 w-4 mr-3" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    navigate('/settings')
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Settings className="h-4 w-4 mr-3" />
                  Settings
                </button>
                <hr className="my-1 border-slate-200 dark:border-slate-700" />
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

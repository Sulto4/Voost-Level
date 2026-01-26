import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, FolderKanban, DollarSign, TrendingUp, MessageSquare, Phone, Mail, Calendar, CheckSquare, ArrowRightLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import { StatCardSkeleton, CardSkeleton } from '../components/ui/Skeleton'
import type { Activity, Client, Profile } from '../types/database'

interface ActivityWithDetails extends Activity {
  client?: Client | null
  user?: Profile | null
}

export function DashboardPage() {
  const { currentWorkspace } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalClients: 0,
    activeProjects: 0,
    pipelineValue: 0,
    winRate: 0,
  })
  const [recentActivities, setRecentActivities] = useState<ActivityWithDetails[]>([])

  useEffect(() => {
    if (currentWorkspace) {
      fetchDashboardStats()
    }
  }, [currentWorkspace])

  async function fetchDashboardStats() {
    if (!currentWorkspace) return

    setLoading(true)

    // Fetch all clients for this workspace
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, status, value')
      .eq('workspace_id', currentWorkspace.id)

    if (clientsError) {
      console.error('Error fetching clients:', clientsError)
    }

    const clients = clientsData || []
    const totalClients = clients.length
    const activeClients = clients.filter(c => c.status === 'active').length
    const pipelineValue = clients.reduce((sum, c) => sum + (c.value || 0), 0)

    // Calculate win rate (active / total * 100)
    const winRate = totalClients > 0
      ? Math.round((activeClients / totalClients) * 100)
      : 0

    // Fetch projects
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('id, status, clients!inner(workspace_id)')
      .eq('clients.workspace_id', currentWorkspace.id)

    if (projectsError) {
      console.error('Error fetching projects:', projectsError)
    }

    const projects = projectsData || []
    const activeProjects = projects.filter(p =>
      p.status === 'in_progress' || p.status === 'planning' || p.status === 'review'
    ).length

    setStats({
      totalClients,
      activeProjects,
      pipelineValue,
      winRate,
    })

    // Fetch recent activities for clients in this workspace
    if (clients.length > 0) {
      const clientIds = clients.map(c => c.id)
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select('*')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false })
        .limit(10)

      if (activitiesError) {
        console.error('Error fetching activities:', activitiesError)
      } else if (activitiesData && activitiesData.length > 0) {
        // Fetch user profiles for activities
        const userIds = [...new Set(activitiesData.map(a => a.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)

        // Map activities with client and user details
        const activitiesWithDetails: ActivityWithDetails[] = activitiesData.map(activity => ({
          ...activity,
          client: clients.find(c => c.id === activity.client_id) || null,
          user: profiles?.find(p => p.id === activity.user_id) || null,
        }))

        setRecentActivities(activitiesWithDetails)
      }
    } else {
      setRecentActivities([])
    }

    setLoading(false)
  }

  const statsDisplay = [
    { name: 'Total Clients', value: stats.totalClients.toString(), icon: Users, change: '+0%' },
    { name: 'Active Projects', value: stats.activeProjects.toString(), icon: FolderKanban, change: '+0%' },
    { name: 'Pipeline Value', value: `$${stats.pipelineValue.toLocaleString()}`, icon: DollarSign, change: '+0%' },
    { name: 'Win Rate', value: `${stats.winRate}%`, icon: TrendingUp, change: '+0%' },
  ]

  function getActivityIcon(type: Activity['type']) {
    switch (type) {
      case 'note':
        return <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      case 'call':
        return <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'email':
        return <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400" />
      case 'meeting':
        return <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      case 'task':
        return <CheckSquare className="h-4 w-4 text-teal-600 dark:text-teal-400" />
      case 'status_change':
        return <ArrowRightLeft className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      default:
        return <MessageSquare className="h-4 w-4 text-slate-600 dark:text-slate-400" />
    }
  }

  function getActivityIconBg(type: Activity['type']) {
    switch (type) {
      case 'note':
        return 'bg-blue-100 dark:bg-blue-900/30'
      case 'call':
        return 'bg-green-100 dark:bg-green-900/30'
      case 'email':
        return 'bg-purple-100 dark:bg-purple-900/30'
      case 'meeting':
        return 'bg-orange-100 dark:bg-orange-900/30'
      case 'task':
        return 'bg-teal-100 dark:bg-teal-900/30'
      case 'status_change':
        return 'bg-indigo-100 dark:bg-indigo-900/30'
      default:
        return 'bg-slate-100 dark:bg-slate-800'
    }
  }

  function getActivityDescription(activity: ActivityWithDetails) {
    switch (activity.type) {
      case 'note':
        return `added a note${activity.content ? `: "${activity.content.substring(0, 50)}${activity.content.length > 50 ? '...' : ''}"` : ''}`
      case 'call':
        return 'logged a call'
      case 'email':
        return 'sent an email'
      case 'meeting':
        return 'scheduled a meeting'
      case 'task':
        return activity.content || 'created a task'
      case 'status_change':
        return activity.content || 'changed status'
      default:
        return activity.content || 'performed an action'
    }
  }

  function formatRelativeTime(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return 'Just now'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} hour${hours === 1 ? '' : 's'} ago`
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days} day${days === 1 ? '' : 's'} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Welcome to Voost Level. Here's an overview of your workspace.
          </p>
        </div>
        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        {/* Activity Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Welcome to Voost Level. Here's an overview of your workspace.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsDisplay.map((stat) => (
          <div key={stat.name} className="card p-6">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <stat.icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                {stat.change}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {stat.value}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {stat.name}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity & Pipeline Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          {recentActivities.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <p>No recent activity</p>
              <p className="text-sm mt-1">
                Activity will appear here as you interact with clients
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${getActivityIconBg(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 dark:text-white">
                      <span className="font-medium">{activity.user?.full_name || 'User'}</span>
                      {' '}
                      <span className="text-slate-500 dark:text-slate-400">
                        {getActivityDescription(activity)}
                      </span>
                    </p>
                    {activity.client && (
                      <Link
                        to={`/clients/${activity.client.id}`}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {activity.client.name}
                      </Link>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {formatRelativeTime(activity.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline Overview */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Pipeline Overview
          </h2>
          {stats.totalClients === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <p>No pipeline data</p>
              <p className="text-sm mt-1">
                Add clients to your pipeline to see an overview
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Total Clients</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats.totalClients}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Pipeline Value</span>
                <span className="font-semibold text-primary-600 dark:text-primary-400">${stats.pipelineValue.toLocaleString()}</span>
              </div>
              <Link
                to="/pipeline"
                className="block text-center mt-4 py-3 text-sm text-primary-600 dark:text-primary-400 hover:underline min-h-[44px]"
              >
                View Pipeline →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Empty State Prompt - only show if no clients */}
      {stats.totalClients === 0 && (
        <div className="card p-8 text-center">
          <div className="mx-auto w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Get started by adding your first client
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-md mx-auto">
            Track your leads and clients, manage projects, and grow your business
            with Voost Level.
          </p>
          <Link to="/clients" className="btn-primary inline-flex">
            Add Your First Client
          </Link>
        </div>
      )}
    </div>
  )
}

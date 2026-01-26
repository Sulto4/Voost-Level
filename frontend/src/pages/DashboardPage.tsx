import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, FolderKanban, DollarSign, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'

export function DashboardPage() {
  const { currentWorkspace } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalClients: 0,
    activeProjects: 0,
    pipelineValue: 0,
    winRate: 0,
  })

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

    setLoading(false)
  }

  const statsDisplay = [
    { name: 'Total Clients', value: stats.totalClients.toString(), icon: Users, change: '+0%' },
    { name: 'Active Projects', value: stats.activeProjects.toString(), icon: FolderKanban, change: '+0%' },
    { name: 'Pipeline Value', value: `$${stats.pipelineValue.toLocaleString()}`, icon: DollarSign, change: '+0%' },
    { name: 'Win Rate', value: `${stats.winRate}%`, icon: TrendingUp, change: '+0%' },
  ]

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400">Loading dashboard...</p>
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
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p>No recent activity</p>
            <p className="text-sm mt-1">
              Activity will appear here as you interact with clients
            </p>
          </div>
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

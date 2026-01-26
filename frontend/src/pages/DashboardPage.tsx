import { Users, FolderKanban, DollarSign, TrendingUp } from 'lucide-react'

export function DashboardPage() {
  // These would come from real API calls
  const stats = [
    { name: 'Total Clients', value: '0', icon: Users, change: '+0%' },
    { name: 'Active Projects', value: '0', icon: FolderKanban, change: '+0%' },
    { name: 'Pipeline Value', value: '$0', icon: DollarSign, change: '+0%' },
    { name: 'Win Rate', value: '0%', icon: TrendingUp, change: '+0%' },
  ]

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
        {stats.map((stat) => (
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
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p>No pipeline data</p>
            <p className="text-sm mt-1">
              Add clients to your pipeline to see an overview
            </p>
          </div>
        </div>
      </div>

      {/* Empty State Prompt */}
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
        <button className="btn-primary">
          Add Your First Client
        </button>
      </div>
    </div>
  )
}

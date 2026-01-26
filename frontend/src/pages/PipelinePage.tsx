import { Plus, Settings } from 'lucide-react'

export function PipelinePage() {
  // Default pipeline stages - would come from API
  const stages = [
    { id: '1', name: 'Lead', color: '#6366F1', clients: [] },
    { id: '2', name: 'Contacted', color: '#F59E0B', clients: [] },
    { id: '3', name: 'Proposal', color: '#10B981', clients: [] },
    { id: '4', name: 'Negotiation', color: '#8B5CF6', clients: [] },
    { id: '5', name: 'Won', color: '#22C55E', clients: [] },
    { id: '6', name: 'Lost', color: '#EF4444', clients: [] },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Pipeline
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Drag and drop clients between stages
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="btn-outline">
            <Settings className="h-5 w-5 mr-2" />
            Edit Stages
          </button>
          <button className="btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Add Client
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex-shrink-0 w-72 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4"
          >
            {/* Stage Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {stage.name}
                </h3>
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                  ({stage.clients.length})
                </span>
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                $0
              </span>
            </div>

            {/* Stage Content */}
            <div className="space-y-3 min-h-[200px]">
              {stage.clients.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                  No clients in this stage
                </div>
              ) : (
                stage.clients.map((client: any) => (
                  <div
                    key={client.id}
                    className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <h4 className="font-medium text-slate-900 dark:text-white">
                      {client.name}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {client.company}
                    </p>
                    <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-2">
                      ${client.value?.toLocaleString() || '0'}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add Client Button */}
            <button className="w-full mt-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors">
              <Plus className="h-4 w-4 inline mr-1" />
              Add Client
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

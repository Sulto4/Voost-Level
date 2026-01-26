import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Settings, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import type { Client, PipelineStage } from '../types/database'

interface StageWithClients extends PipelineStage {
  clients: Client[]
}

// Default stages to use if no stages exist in the database
const defaultStages = [
  { name: 'Lead', color: '#6366F1' },
  { name: 'Contacted', color: '#F59E0B' },
  { name: 'Proposal', color: '#10B981' },
  { name: 'Negotiation', color: '#8B5CF6' },
  { name: 'Won', color: '#22C55E' },
  { name: 'Lost', color: '#EF4444' },
]

export function PipelinePage() {
  const { currentWorkspace } = useWorkspace()
  const [stages, setStages] = useState<StageWithClients[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentWorkspace) {
      fetchPipelineData()
    }
  }, [currentWorkspace])

  async function fetchPipelineData() {
    if (!currentWorkspace) return

    setLoading(true)

    // Fetch pipeline stages
    const { data: stagesData, error: stagesError } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('position', { ascending: true })

    if (stagesError) {
      console.error('Error fetching pipeline stages:', stagesError)
    }

    // Fetch all clients for this workspace
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false })

    if (clientsError) {
      console.error('Error fetching clients:', clientsError)
    }

    const clients = clientsData || []

    // If no stages exist, create default stages with clients grouped by status
    if (!stagesData || stagesData.length === 0) {
      // Create virtual stages based on client status
      const virtualStages: StageWithClients[] = defaultStages.map((stage, index) => ({
        id: `virtual-${index}`,
        workspace_id: currentWorkspace.id,
        name: stage.name,
        color: stage.color,
        position: index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        clients: [],
      }))

      // Group clients by their status into virtual stages
      clients.forEach(client => {
        if (client.status === 'lead') {
          virtualStages[0].clients.push(client) // Lead
        } else if (client.status === 'active') {
          virtualStages[4].clients.push(client) // Won
        } else if (client.status === 'inactive' || client.status === 'churned') {
          virtualStages[5].clients.push(client) // Lost
        }
      })

      setStages(virtualStages)
    } else {
      // Use actual stages and group clients by pipeline_stage_id
      const stagesWithClients: StageWithClients[] = stagesData.map(stage => ({
        ...stage,
        clients: clients.filter(client => client.pipeline_stage_id === stage.id),
      }))

      // Also add clients without a pipeline_stage_id to the first stage
      const unassignedClients = clients.filter(client => !client.pipeline_stage_id)
      if (stagesWithClients.length > 0) {
        stagesWithClients[0].clients.push(...unassignedClients)
      }

      setStages(stagesWithClients)
    }

    setLoading(false)
  }

  function calculateStageValue(clients: Client[]): number {
    return clients.reduce((sum, client) => sum + (client.value || 0), 0)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400">Loading pipeline...</p>
      </div>
    )
  }

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
                  style={{ backgroundColor: stage.color || '#6366F1' }}
                />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {stage.name}
                </h3>
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                  ({stage.clients.length})
                </span>
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center">
                <DollarSign className="h-3 w-3" />
                {calculateStageValue(stage.clients).toLocaleString()}
              </span>
            </div>

            {/* Stage Content */}
            <div className="space-y-3 min-h-[200px]">
              {stage.clients.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                  No clients in this stage
                </div>
              ) : (
                stage.clients.map((client) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="block bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <h4 className="font-medium text-slate-900 dark:text-white">
                      {client.name}
                    </h4>
                    {client.company && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {client.company}
                      </p>
                    )}
                    {client.value && (
                      <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-2 flex items-center">
                        <DollarSign className="h-3 w-3" />
                        {client.value.toLocaleString()}
                      </p>
                    )}
                  </Link>
                ))
              )}
            </div>

            {/* Add Client Button */}
            <button className="w-full mt-3 min-h-[44px] py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors">
              <Plus className="h-4 w-4 inline mr-1" />
              Add Client
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

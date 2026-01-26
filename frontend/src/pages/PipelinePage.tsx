import { useState, useEffect, DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Settings, DollarSign, Trophy, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import type { Client, PipelineStage, ClientStatus } from '../types/database'

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
  const { user } = useAuth()
  const [stages, setStages] = useState<StageWithClients[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedClient, setDraggedClient] = useState<Client | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [winLossStats, setWinLossStats] = useState({ won: 0, lost: 0, wonValue: 0, lostValue: 0 })

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
      calculateWinLossStats(virtualStages)
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
      calculateWinLossStats(stagesWithClients)
    }

    setLoading(false)
  }

  function calculateStageValue(clients: Client[]): number {
    return clients.reduce((sum, client) => sum + (client.value || 0), 0)
  }

  // Calculate win/loss stats from stages
  function calculateWinLossStats(stagesList: StageWithClients[]) {
    const wonStage = stagesList.find(s => s.name === 'Won')
    const lostStage = stagesList.find(s => s.name === 'Lost')

    setWinLossStats({
      won: wonStage?.clients.length || 0,
      lost: lostStage?.clients.length || 0,
      wonValue: wonStage ? calculateStageValue(wonStage.clients) : 0,
      lostValue: lostStage ? calculateStageValue(lostStage.clients) : 0,
    })
  }

  // Drag and drop handlers
  function handleDragStart(e: DragEvent<HTMLDivElement>, client: Client) {
    setDraggedClient(client)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', client.id)
  }

  function handleDragEnd() {
    setDraggedClient(null)
    setDragOverStage(null)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, stageId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageId)
  }

  function handleDragLeave() {
    setDragOverStage(null)
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>, targetStage: StageWithClients) {
    e.preventDefault()
    setDragOverStage(null)

    if (!draggedClient || !user) return

    // Find the source stage
    const sourceStage = stages.find(s => s.clients.some(c => c.id === draggedClient.id))
    if (!sourceStage || sourceStage.id === targetStage.id) {
      setDraggedClient(null)
      return
    }

    // Determine new status based on target stage name
    let newStatus: ClientStatus = draggedClient.status
    if (targetStage.name === 'Won') {
      newStatus = 'active'
    } else if (targetStage.name === 'Lost') {
      newStatus = 'churned'
    } else if (targetStage.name === 'Lead') {
      newStatus = 'lead'
    }

    // Update locally first for immediate UI feedback
    setStages(prevStages => {
      const newStages = prevStages.map(stage => {
        if (stage.id === sourceStage.id) {
          return {
            ...stage,
            clients: stage.clients.filter(c => c.id !== draggedClient.id)
          }
        }
        if (stage.id === targetStage.id) {
          return {
            ...stage,
            clients: [...stage.clients, { ...draggedClient, status: newStatus }]
          }
        }
        return stage
      })
      calculateWinLossStats(newStages)
      return newStages
    })

    // Update in database
    const updateData: { status: ClientStatus; pipeline_stage_id?: string | null } = {
      status: newStatus
    }

    // Only set pipeline_stage_id if it's a real stage (not virtual)
    if (!targetStage.id.startsWith('virtual-')) {
      updateData.pipeline_stage_id = targetStage.id
    } else {
      updateData.pipeline_stage_id = null
    }

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', draggedClient.id)

    if (error) {
      console.error('Error updating client:', error)
      // Revert on error
      fetchPipelineData()
    } else {
      // Log the pipeline stage change as an activity
      await supabase
        .from('activities')
        .insert({
          client_id: draggedClient.id,
          user_id: user.id,
          type: 'status_change',
          content: `Moved from ${sourceStage.name} to ${targetStage.name}`,
          metadata: {
            from_stage: sourceStage.name,
            to_stage: targetStage.name,
            from_status: draggedClient.status,
            to_status: newStatus
          }
        })
    }

    setDraggedClient(null)
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

      {/* Win/Loss Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center space-x-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{winLossStats.won}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Won Deals</p>
          </div>
        </div>
        <div className="card p-4 flex items-center space-x-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">${winLossStats.wonValue.toLocaleString()}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Won Value</p>
          </div>
        </div>
        <div className="card p-4 flex items-center space-x-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{winLossStats.lost}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Lost Deals</p>
          </div>
        </div>
        <div className="card p-4 flex items-center space-x-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <DollarSign className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">${winLossStats.lostValue.toLocaleString()}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Lost Value</p>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={`flex-shrink-0 w-72 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 transition-colors ${
              dragOverStage === stage.id ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage)}
          >
            {/* Stage Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: stage.color || '#6366F1' }}
                />
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  {stage.name}
                </h2>
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                  ({stage.clients.length})
                </span>
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center">
                <DollarSign className="h-3 w-3 mr-0.5" />
                ${calculateStageValue(stage.clients).toLocaleString()}
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
                  <div
                    key={client.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, client)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700 cursor-grab hover:shadow-md transition-all ${
                      draggedClient?.id === client.id ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    <Link to={`/clients/${client.id}`} className="block">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {client.name}
                      </h3>
                      {client.company && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {client.company}
                        </p>
                      )}
                      {client.value && (
                        <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-2 flex items-center">
                          <DollarSign className="h-3 w-3 mr-0.5" />
                          ${client.value.toLocaleString()}
                        </p>
                      )}
                    </Link>
                  </div>
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

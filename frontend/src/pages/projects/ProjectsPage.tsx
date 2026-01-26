import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, MoreHorizontal, Calendar, DollarSign, Building2, AlertTriangle, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { AddProjectModal } from '../../components/projects/AddProjectModal'
import type { Project, Client } from '../../types/database'

interface ProjectWithClient extends Project {
  clients: Pick<Client, 'id' | 'name' | 'company'> | null
}

export function ProjectsPage() {
  const { currentWorkspace } = useWorkspace()
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<ProjectWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)

  useEffect(() => {
    if (currentWorkspace) {
      fetchProjects()
    }
  }, [currentWorkspace])

  async function fetchProjects() {
    if (!currentWorkspace) return

    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        clients!inner (
          id,
          name,
          company,
          workspace_id
        )
      `)
      .eq('clients.workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects:', error)
    } else {
      setProjects(data || [])
    }
    setLoading(false)
  }

  // Get unique clients from projects for the filter dropdown
  const uniqueClients = projects.reduce((acc, project) => {
    if (project.clients && !acc.find(c => c.id === project.clients?.id)) {
      acc.push({ id: project.clients.id, name: project.clients.name, company: project.clients.company })
    }
    return acc
  }, [] as { id: string; name: string; company: string | null }[]).sort((a, b) => a.name.localeCompare(b.name))

  const filteredProjects = projects.filter((project) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = (
      project.name.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query) ||
      project.clients?.name.toLowerCase().includes(query) ||
      project.clients?.company?.toLowerCase().includes(query)
    )
    const matchesClientFilter = !selectedClientId || project.clients?.id === selectedClientId
    return matchesSearch && matchesClientFilter
  })

  const statusColors: Record<string, string> = {
    planning: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }

  // Helper function to check if a project is overdue
  function isOverdue(project: ProjectWithClient): boolean {
    if (!project.due_date) return false
    if (project.status === 'completed' || project.status === 'cancelled') return false
    const dueDate = new Date(project.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return dueDate < today
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Projects
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Track and manage your client projects
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-5 w-5 mr-2" />
          Add Project
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="search"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="relative">
          <button
            className={`btn-outline min-h-[44px] ${selectedClientId ? 'ring-2 ring-primary-500' : ''}`}
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
          >
            <Filter className="h-5 w-5 mr-2" />
            {selectedClientId ? 'Client Filter' : 'Filters'}
            {selectedClientId && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                1
              </span>
            )}
          </button>

          {/* Filter Dropdown */}
          {isFilterDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsFilterDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                      Filter by Client
                    </h3>
                    {selectedClientId && (
                      <button
                        onClick={() => {
                          setSelectedClientId(null)
                          setIsFilterDropdownOpen(false)
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {uniqueClients.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 p-2">
                      No clients with projects
                    </p>
                  ) : (
                    uniqueClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClientId(client.id === selectedClientId ? null : client.id)
                          setIsFilterDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedClientId === client.id
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="font-medium">{client.name}</div>
                        {client.company && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {client.company}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {selectedClientId && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Filters:</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-sm rounded-full">
            <Building2 className="h-3 w-3" />
            {uniqueClients.find(c => c.id === selectedClientId)?.name}
            <button
              onClick={() => setSelectedClientId(null)}
              className="ml-1 hover:text-primary-900 dark:hover:text-primary-100"
              aria-label="Remove filter"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
            <Calendar className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            {searchQuery ? 'No projects found' : 'No projects yet'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
            {searchQuery
              ? 'Try a different search term.'
              : 'Create your first project to start tracking work for your clients.'}
          </p>
          {!searchQuery && (
            <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Project
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredProjects.map((project) => (
                <tr
                  key={project.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    isOverdue(project) ? 'bg-red-50 dark:bg-red-900/10' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div>
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-sm font-medium text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center min-h-[44px] -my-3"
                      >
                        {project.name}
                      </Link>
                      {project.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {project.clients ? (
                      <div>
                        <Link
                          to={`/clients/${project.clients.id}`}
                          className="text-sm text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center min-h-[44px] -my-3"
                        >
                          {project.clients.name}
                        </Link>
                        {project.clients.company && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center mt-0.5">
                            <Building2 className="h-3 w-3 mr-1" />
                            {project.clients.company}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[project.status]}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {project.due_date ? (
                      <span className={`flex items-center ${
                        isOverdue(project)
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {isOverdue(project) ? (
                          <AlertTriangle className="h-4 w-4 mr-1" />
                        ) : (
                          <Calendar className="h-4 w-4 mr-1" />
                        )}
                        {new Date(project.due_date).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {project.budget ? (
                      <span className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-0.5" />
                        {project.budget.toLocaleString()}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="icon-btn" aria-label="Project actions">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Project Stats - Report showing projects by status */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Projects</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{projects.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Planning</p>
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{projects.filter(p => p.status === 'planning').length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{projects.filter(p => p.status === 'in_progress').length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Review</p>
            <p className="text-2xl font-bold text-yellow-600">{projects.filter(p => p.status === 'review').length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Completed</p>
            <p className="text-2xl font-bold text-green-600">{projects.filter(p => p.status === 'completed').length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Cancelled</p>
            <p className="text-2xl font-bold text-red-600">{projects.filter(p => p.status === 'cancelled').length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Budget</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              ${projects.reduce((sum, p) => sum + (p.budget || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onProjectAdded={fetchProjects}
      />
    </div>
  )
}

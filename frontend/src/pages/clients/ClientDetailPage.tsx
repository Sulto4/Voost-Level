import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Mail, Phone, Globe, Building2, Plus, Calendar, DollarSign, MessageSquare, Users, CheckSquare } from 'lucide-react'
import { clsx } from 'clsx'
import { supabase } from '../../lib/supabase'
import { EditClientModal } from '../../components/clients/EditClientModal'
import { AddProjectModal } from '../../components/projects/AddProjectModal'
import { EditProjectModal } from '../../components/projects/EditProjectModal'
import { LogActivityModal } from '../../components/activities/LogActivityModal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import type { Client, Project, Activity, ActivityType } from '../../types/database'

const tabs = ['Overview', 'Projects', 'Activity', 'Files']

export function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false)
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [isLogActivityModalOpen, setIsLogActivityModalOpen] = useState(false)
  const [defaultActivityType, setDefaultActivityType] = useState<ActivityType>('call')
  const [activities, setActivities] = useState<Activity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  useEffect(() => {
    if (id) {
      fetchClient()
      fetchProjects()
      fetchActivities()
    }
  }, [id])

  async function fetchClient() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching client:', error)
      setClient(null)
    } else {
      setClient(data)
    }
    setLoading(false)
  }

  async function fetchProjects() {
    if (!id) return
    setProjectsLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects:', error)
    } else {
      setProjects(data || [])
    }
    setProjectsLoading(false)
  }

  async function fetchActivities() {
    if (!id) return
    setActivitiesLoading(true)
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching activities:', error)
    } else {
      setActivities(data || [])
    }
    setActivitiesLoading(false)
  }

  function openLogActivity(type: ActivityType = 'call') {
    setDefaultActivityType(type)
    setIsLogActivityModalOpen(true)
  }

  const activityIcons: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
    call: Phone,
    email: Mail,
    meeting: Users,
    note: MessageSquare,
    task: CheckSquare,
    status_change: Edit,
  }

  const activityColors: Record<ActivityType, string> = {
    call: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    email: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    meeting: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    note: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    task: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    status_change: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  }

  async function handleDelete() {
    if (!client) return

    setDeleting(true)
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id)

    if (error) {
      console.error('Error deleting client:', error)
      setDeleting(false)
    } else {
      // Navigate back to clients list
      navigate('/clients')
    }
  }

  const statusColors: Record<string, string> = {
    lead: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    inactive: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    churned: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400">Loading client...</p>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Client not found
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          The client you're looking for doesn't exist or you don't have access to it.
        </p>
        <Link to="/clients" className="btn-primary">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Clients
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Clients', href: '/clients' },
          { label: client.name },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-xl">
            {client.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {client.name}
            </h1>
            {client.company && (
              <p className="text-slate-500 dark:text-slate-400 truncate">{client.company}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn-outline"
          >
            <Edit className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            onClick={() => setIsDeleteDialogOpen(true)}
            className="btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <nav className="flex space-x-4 sm:space-x-8 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'py-4 px-2 min-w-[44px] min-h-[44px] border-b-2 font-medium text-sm transition-colors whitespace-nowrap',
                activeTab === tab
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card p-6">
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Contact Information
                </h2>
                <div className="space-y-3">
                  {client.email && (
                    <div className="flex items-center text-slate-600 dark:text-slate-300 min-h-[44px]">
                      <Mail className="h-5 w-5 mr-3 text-slate-400 flex-shrink-0" />
                      <a href={`mailto:${client.email}`} className="hover:text-primary-600 min-h-[44px] inline-flex items-center">
                        {client.email}
                      </a>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center text-slate-600 dark:text-slate-300 min-h-[44px]">
                      <Phone className="h-5 w-5 mr-3 text-slate-400 flex-shrink-0" />
                      <a href={`tel:${client.phone}`} className="hover:text-primary-600 min-h-[44px] inline-flex items-center">
                        {client.phone}
                      </a>
                    </div>
                  )}
                  {client.website && (
                    <div className="flex items-center text-slate-600 dark:text-slate-300 min-h-[44px]">
                      <Globe className="h-5 w-5 mr-3 text-slate-400 flex-shrink-0" />
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary-600 min-h-[44px] inline-flex items-center"
                      >
                        {client.website}
                      </a>
                    </div>
                  )}
                  {client.company && (
                    <div className="flex items-center text-slate-600 dark:text-slate-300">
                      <Building2 className="h-5 w-5 mr-3 text-slate-400" />
                      <span>{client.company}</span>
                    </div>
                  )}
                  {!client.email && !client.phone && !client.website && !client.company && (
                    <p className="text-slate-400 dark:text-slate-500 italic">
                      No contact information provided
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Details
                </h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Status</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[client.status]}`}>
                        {client.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Source</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {client.source || <span className="text-slate-400 italic">Not specified</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Deal Value</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {client.value ? `$${client.value.toLocaleString()}` : <span className="text-slate-400 italic">Not specified</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Created</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {new Date(client.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Notes Section */}
            {client.notes && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Notes
                </h2>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {client.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'Projects' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Projects ({projects.length})
              </h2>
              <button
                onClick={() => setIsAddProjectModalOpen(true)}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </button>
            </div>
            {projectsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-slate-500 dark:text-slate-400">Loading projects...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No projects yet</p>
                <p className="text-sm mt-2">Create your first project to track work for this client.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">
                          {project.name}
                        </h4>
                        {project.description && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {project.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            project.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            project.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            project.status === 'review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            project.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {project.status.replace('_', ' ')}
                          </span>
                          {project.due_date && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Due {new Date(project.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {project.budget && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" />
                              ${project.budget.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProject(project)
                          setIsEditProjectModalOpen(true)
                        }}
                        className="btn-outline p-2 min-w-[44px] min-h-[44px]"
                        title="Edit project"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'Activity' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Activity Timeline
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => openLogActivity('call')}
                  className="btn-outline flex items-center"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Log Call
                </button>
                <button
                  onClick={() => openLogActivity('note')}
                  className="btn-primary flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </button>
              </div>
            </div>
            {activitiesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-slate-500 dark:text-slate-400">Loading activities...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No activity yet</p>
                <p className="text-sm mt-2">Log a call or add a note to start tracking activity.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const Icon = activityIcons[activity.type]
                  const colorClass = activityColors[activity.type]
                  const metadata = activity.metadata as Record<string, unknown> | null

                  return (
                    <div
                      key={activity.id}
                      className="flex gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900 dark:text-white capitalize">
                            {activity.type === 'status_change' ? 'Status Change' : activity.type}
                          </span>
                          {metadata?.duration && (
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                              {String(metadata.duration)}
                            </span>
                          )}
                          {metadata?.outcome && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              metadata.outcome === 'positive' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              metadata.outcome === 'negative' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {String(metadata.outcome).replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        {activity.content && (
                          <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                            {activity.content}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                          {new Date(activity.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {activeTab === 'Files' && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p>No files yet</p>
            <button className="btn-primary mt-4">Upload File</button>
          </div>
        )}
      </div>

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        client={client}
        onClientUpdated={fetchClient}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Are you sure you want to delete "${client.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* Add Project Modal */}
      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        client={client}
        onProjectAdded={fetchProjects}
      />

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={isEditProjectModalOpen}
        onClose={() => {
          setIsEditProjectModalOpen(false)
          setSelectedProject(null)
        }}
        project={selectedProject}
        onProjectUpdated={fetchProjects}
      />

      {/* Log Activity Modal */}
      <LogActivityModal
        isOpen={isLogActivityModalOpen}
        onClose={() => setIsLogActivityModalOpen(false)}
        clientId={client.id}
        onActivityLogged={fetchActivities}
        defaultType={defaultActivityType}
      />
    </div>
  )
}

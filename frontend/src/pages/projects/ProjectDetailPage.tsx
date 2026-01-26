import { useState, useEffect, DragEvent } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Plus, CheckSquare, Calendar, DollarSign, Building2, AlertCircle, Flag, CheckCircle, User, GripVertical, ChevronDown, ChevronRight, Filter, X } from 'lucide-react'
import { clsx } from 'clsx'
import { supabase } from '../../lib/supabase'
import { EditProjectModal } from '../../components/projects/EditProjectModal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { AddTaskModal } from '../../components/tasks/AddTaskModal'
import { EditTaskModal } from '../../components/tasks/EditTaskModal'
import { AddMilestoneModal } from '../../components/milestones/AddMilestoneModal'
import type { Project, Client, Task, Milestone, Profile } from '../../types/database'

interface ProjectWithClient extends Project {
  clients: Pick<Client, 'id' | 'name' | 'company'> | null
}

interface TaskWithAssignee extends Task {
  assignee?: Pick<Profile, 'id' | 'full_name' | 'email'> | null
  subtasks?: TaskWithAssignee[]
}

const tabs = ['Overview', 'Milestones', 'Tasks', 'Files']

export function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')
  const [project, setProject] = useState<ProjectWithClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false)
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false)
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null)
  const [deletingTask, setDeletingTask] = useState(false)
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [milestonesLoading, setMilestonesLoading] = useState(false)
  const [isAddMilestoneModalOpen, setIsAddMilestoneModalOpen] = useState(false)
  const [quickAddTaskTitle, setQuickAddTaskTitle] = useState('')
  const [quickAddLoading, setQuickAddLoading] = useState(false)
  const [draggedTask, setDraggedTask] = useState<TaskWithAssignee | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [addingSubtaskToTaskId, setAddingSubtaskToTaskId] = useState<string | null>(null)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string | null>(null) // null = all, 'unassigned' = unassigned, or user ID
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string | null>(null) // null = all, or 'low' | 'medium' | 'high'
  const [isTaskFilterDropdownOpen, setIsTaskFilterDropdownOpen] = useState(false)

  useEffect(() => {
    if (id) {
      fetchProject()
      fetchTasks()
      fetchMilestones()
    }
  }, [id])

  async function fetchProject() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        clients (
          id,
          name,
          company
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching project:', error)
      setProject(null)
    } else {
      setProject(data)
    }
    setLoading(false)
  }

  async function fetchTasks() {
    if (!id) return
    setTasksLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tasks:', error)
      setTasks([])
    } else {
      // Fetch assignee profiles for tasks that have assigned_to
      const tasksWithAssignees = await Promise.all(
        (data || []).map(async (task) => {
          if (task.assigned_to) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', task.assigned_to)
              .single()
            return { ...task, assignee: profile }
          }
          return { ...task, assignee: null }
        })
      )

      // Organize tasks into parent/child structure
      const parentTasks: TaskWithAssignee[] = []
      const subtaskMap: Map<string, TaskWithAssignee[]> = new Map()

      for (const task of tasksWithAssignees) {
        if (task.parent_id) {
          const existing = subtaskMap.get(task.parent_id) || []
          existing.push(task)
          subtaskMap.set(task.parent_id, existing)
        } else {
          parentTasks.push(task)
        }
      }

      // Attach subtasks to parent tasks
      const organizedTasks = parentTasks.map(task => ({
        ...task,
        subtasks: subtaskMap.get(task.id) || []
      }))

      setTasks(organizedTasks)
    }
    setTasksLoading(false)
  }

  async function fetchMilestones() {
    if (!id) return
    setMilestonesLoading(true)
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', id)
      .order('due_date', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Error fetching milestones:', error)
    } else {
      setMilestones(data || [])
    }
    setMilestonesLoading(false)
  }

  async function toggleMilestoneComplete(milestone: Milestone) {
    const newCompleted = !milestone.completed
    const { error } = await supabase
      .from('milestones')
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq('id', milestone.id)

    if (error) {
      console.error('Error updating milestone:', error)
    } else {
      fetchMilestones()
    }
  }

  // Drag and drop handlers for task reordering
  function handleTaskDragStart(e: DragEvent<HTMLDivElement>, task: TaskWithAssignee) {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
  }

  function handleTaskDragEnd() {
    setDraggedTask(null)
    setDragOverTaskId(null)
  }

  function handleTaskDragOver(e: DragEvent<HTMLDivElement>, taskId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedTask && draggedTask.id !== taskId) {
      setDragOverTaskId(taskId)
    }
  }

  function handleTaskDragLeave() {
    setDragOverTaskId(null)
  }

  async function handleTaskDrop(e: DragEvent<HTMLDivElement>, targetTask: TaskWithAssignee) {
    e.preventDefault()
    setDragOverTaskId(null)

    if (!draggedTask || draggedTask.id === targetTask.id) {
      setDraggedTask(null)
      return
    }

    // Find indices
    const oldIndex = tasks.findIndex(t => t.id === draggedTask.id)
    const newIndex = tasks.findIndex(t => t.id === targetTask.id)

    if (oldIndex === -1 || newIndex === -1) {
      setDraggedTask(null)
      return
    }

    // Create new array with reordered tasks
    const newTasks = [...tasks]
    newTasks.splice(oldIndex, 1)
    newTasks.splice(newIndex, 0, draggedTask)

    // Update state immediately for responsive UI
    setTasks(newTasks)

    // Update sort_order in database
    const updates = newTasks.map((task, index) => ({
      id: task.id,
      sort_order: index + 1,
    }))

    // Update each task's sort_order
    for (const update of updates) {
      await supabase
        .from('tasks')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
    }

    setDraggedTask(null)
  }

  async function handleDelete() {
    if (!project) return

    setDeleting(true)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', project.id)

    if (error) {
      console.error('Error deleting project:', error)
      setDeleting(false)
    } else {
      // Navigate back to projects list
      navigate('/projects')
    }
  }

  async function handleDeleteTask() {
    if (!selectedTask) return

    setDeletingTask(true)
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', selectedTask.id)

    if (error) {
      console.error('Error deleting task:', error)
      setDeletingTask(false)
    } else {
      setDeletingTask(false)
      setIsDeleteTaskDialogOpen(false)
      setSelectedTask(null)
      fetchTasks()
    }
  }

  async function toggleTaskStatus(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id)

    if (error) {
      console.error('Error updating task status:', error)
    } else {
      fetchTasks()
    }
  }

  async function handleQuickAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!quickAddTaskTitle.trim() || !id) return

    setQuickAddLoading(true)
    const { error } = await supabase
      .from('tasks')
      .insert({
        project_id: id,
        title: quickAddTaskTitle.trim(),
        status: 'todo',
        priority: 'medium',
      })

    if (error) {
      console.error('Error creating task:', error)
    } else {
      setQuickAddTaskTitle('')
      fetchTasks()
    }
    setQuickAddLoading(false)
  }

  // Toggle expand/collapse for subtasks
  function toggleExpand(taskId: string) {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  // Handle adding a subtask
  async function handleAddSubtask(e: React.FormEvent, parentTaskId: string) {
    e.preventDefault()
    if (!subtaskTitle.trim() || !id) return

    setAddingSubtask(true)
    const { error } = await supabase
      .from('tasks')
      .insert({
        project_id: id,
        parent_id: parentTaskId,
        title: subtaskTitle.trim(),
        status: 'todo',
        priority: 'medium',
      })

    if (error) {
      console.error('Error creating subtask:', error)
    } else {
      setSubtaskTitle('')
      setAddingSubtaskToTaskId(null)
      // Expand the parent task to show the new subtask
      setExpandedTasks(prev => new Set([...prev, parentTaskId]))
      fetchTasks()
    }
    setAddingSubtask(false)
  }

  // Calculate subtask completion progress
  function getSubtaskProgress(subtasks: TaskWithAssignee[]): { completed: number; total: number; percentage: number } {
    if (!subtasks || subtasks.length === 0) return { completed: 0, total: 0, percentage: 0 }
    const completed = subtasks.filter(s => s.status === 'done').length
    const total = subtasks.length
    const percentage = Math.round((completed / total) * 100)
    return { completed, total, percentage }
  }

  // Get unique assignees from tasks for the filter dropdown
  const uniqueAssignees = tasks.reduce((acc, task) => {
    if (task.assignee && !acc.find(a => a.id === task.assignee?.id)) {
      acc.push({ id: task.assignee.id, name: task.assignee.full_name || task.assignee.email })
    }
    // Also check subtasks
    task.subtasks?.forEach(subtask => {
      if (subtask.assignee && !acc.find(a => a.id === subtask.assignee?.id)) {
        acc.push({ id: subtask.assignee.id, name: subtask.assignee.full_name || subtask.assignee.email })
      }
    })
    return acc
  }, [] as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name))

  // Check if there are any unassigned tasks
  const hasUnassignedTasks = tasks.some(task =>
    !task.assigned_to || task.subtasks?.some(s => !s.assigned_to)
  )

  // Priority filter options
  const priorityOptions = [
    { value: 'high', label: 'High', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
    { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300' },
  ]

  // Count active task filters
  const activeTaskFilterCount = (taskAssigneeFilter ? 1 : 0) + (taskPriorityFilter ? 1 : 0)

  // Filter tasks by assignee and priority
  const filteredTasks = tasks.filter(task => {
    // Assignee filter
    if (taskAssigneeFilter) {
      if (taskAssigneeFilter === 'unassigned' && task.assigned_to) return false
      if (taskAssigneeFilter !== 'unassigned' && task.assigned_to !== taskAssigneeFilter) return false
    }
    // Priority filter
    if (taskPriorityFilter && task.priority !== taskPriorityFilter) return false
    return true
  })

  const statusColors: Record<string, string> = {
    planning: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400">Loading project...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Project not found
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          The project you're looking for doesn't exist or you don't have access to it.
        </p>
        <Link to="/projects" className="btn-primary">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4 min-w-0">
          <Link
            to="/projects"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-slate-500" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {project.name}
            </h1>
            {project.clients && (
              <Link
                to={`/clients/${project.clients.id}`}
                className="text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center text-sm truncate"
              >
                {project.clients.company && (
                  <>
                    <Building2 className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span className="truncate">{project.clients.company} • {project.clients.name}</span>
                  </>
                )}
                {!project.clients.company && project.clients.name}
              </Link>
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
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap',
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
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Project Details
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Status</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[project.status]}`}>
                        {project.status.replace('_', ' ')}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Client</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {project.clients ? (
                        <Link
                          to={`/clients/${project.clients.id}`}
                          className="hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          {project.clients.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400 italic">No client assigned</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Start Date</dt>
                    <dd className="text-slate-900 dark:text-white flex items-center">
                      {project.start_date ? (
                        <>
                          <Calendar className="h-4 w-4 mr-1 text-slate-400" />
                          {new Date(project.start_date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Due Date</dt>
                    <dd className="text-slate-900 dark:text-white flex items-center">
                      {project.due_date ? (
                        <>
                          <Calendar className="h-4 w-4 mr-1 text-slate-400" />
                          {new Date(project.due_date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Budget</dt>
                    <dd className="text-slate-900 dark:text-white flex items-center">
                      {project.budget ? (
                        <>
                          <DollarSign className="h-4 w-4 mr-0.5 text-slate-400" />
                          {project.budget.toLocaleString()}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Created</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {new Date(project.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Description
                </h3>
                {project.description ? (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {project.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-400 italic">
                    No description provided.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'Milestones' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Milestones ({milestones.length})
              </h3>
              <button
                onClick={() => setIsAddMilestoneModalOpen(true)}
                className="btn-primary text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Milestone
              </button>
            </div>
            {milestonesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-slate-500 dark:text-slate-400">Loading milestones...</p>
              </div>
            ) : milestones.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Flag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No milestones yet</p>
                <p className="text-sm">Create milestones to track project progress</p>
              </div>
            ) : (
              <div className="space-y-3">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      milestone.completed
                        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleMilestoneComplete(milestone)}
                          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            milestone.completed
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500'
                          }`}
                        >
                          {milestone.completed && <CheckCircle className="h-4 w-4" />}
                        </button>
                        <div>
                          <h4 className={`font-medium ${
                            milestone.completed
                              ? 'text-green-700 dark:text-green-400 line-through'
                              : 'text-slate-900 dark:text-white'
                          }`}>
                            <Flag className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                            {milestone.name}
                          </h4>
                          {milestone.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              {milestone.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            {milestone.due_date && (
                              <span className={`text-xs flex items-center ${
                                !milestone.completed && new Date(milestone.due_date) < new Date()
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}>
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(milestone.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {milestone.completed && milestone.completed_at && (
                              <span className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Completed {new Date(milestone.completed_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'Tasks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Tasks ({filteredTasks.length}{activeTaskFilterCount > 0 ? ` of ${tasks.length}` : ''})
              </h3>
              <div className="flex items-center gap-2">
                {/* Task Filters Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsTaskFilterDropdownOpen(!isTaskFilterDropdownOpen)}
                    className={`btn-outline text-sm ${activeTaskFilterCount > 0 ? 'ring-2 ring-primary-500' : ''}`}
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Filters
                    {activeTaskFilterCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                        {activeTaskFilterCount}
                      </span>
                    )}
                  </button>

                  {isTaskFilterDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsTaskFilterDropdownOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20">
                        {/* Priority Filter Section */}
                        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">Priority</span>
                            {taskPriorityFilter && (
                              <button
                                onClick={() => setTaskPriorityFilter(null)}
                                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {priorityOptions.map((priority) => (
                              <button
                                key={priority.value}
                                onClick={() => setTaskPriorityFilter(taskPriorityFilter === priority.value ? null : priority.value)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                  taskPriorityFilter === priority.value
                                    ? priority.color
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                              >
                                {priority.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Assignee Filter Section */}
                        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">Assignee</span>
                            {taskAssigneeFilter && (
                              <button
                                onClick={() => setTaskAssigneeFilter(null)}
                                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            <button
                              onClick={() => setTaskAssigneeFilter(taskAssigneeFilter === null ? null : null)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                                !taskAssigneeFilter
                                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              All
                            </button>
                            {hasUnassignedTasks && (
                              <button
                                onClick={() => setTaskAssigneeFilter('unassigned')}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                                  taskAssigneeFilter === 'unassigned'
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <User className="h-3.5 w-3.5 inline mr-1.5 opacity-50" />
                                Unassigned
                              </button>
                            )}
                            {uniqueAssignees.map((assignee) => (
                              <button
                                key={assignee.id}
                                onClick={() => setTaskAssigneeFilter(assignee.id)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                                  taskAssigneeFilter === assignee.id
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <User className="h-3.5 w-3.5 inline mr-1.5" />
                                {assignee.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Clear All Button */}
                        {activeTaskFilterCount > 0 && (
                          <div className="p-2">
                            <button
                              onClick={() => {
                                setTaskAssigneeFilter(null)
                                setTaskPriorityFilter(null)
                                setIsTaskFilterDropdownOpen(false)
                              }}
                              className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              Clear all filters
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setIsAddTaskModalOpen(true)}
                  className="btn-primary text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </button>
              </div>
            </div>
            {/* Active Filter Display */}
            {activeTaskFilterCount > 0 && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-sm text-slate-500 dark:text-slate-400">Filtering by:</span>
                {taskPriorityFilter && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full ${priorityOptions.find(p => p.value === taskPriorityFilter)?.color}`}>
                    {priorityOptions.find(p => p.value === taskPriorityFilter)?.label} priority
                    <button
                      onClick={() => setTaskPriorityFilter(null)}
                      className="ml-1 hover:opacity-70"
                      aria-label="Clear priority filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {taskAssigneeFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-sm rounded-full">
                    <User className="h-3 w-3" />
                    {taskAssigneeFilter === 'unassigned'
                      ? 'Unassigned'
                      : uniqueAssignees.find(a => a.id === taskAssigneeFilter)?.name}
                    <button
                      onClick={() => setTaskAssigneeFilter(null)}
                      className="ml-1 hover:text-primary-900 dark:hover:text-primary-100"
                      aria-label="Clear assignee filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
            {/* Quick Add Task Input */}
            <form onSubmit={handleQuickAddTask} className="mb-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={quickAddTaskTitle}
                    onChange={(e) => setQuickAddTaskTitle(e.target.value)}
                    placeholder="Quick add task... (press Enter)"
                    className="input pl-10 text-sm"
                    disabled={quickAddLoading}
                  />
                </div>
              </div>
            </form>
            {tasksLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-slate-500 dark:text-slate-400">Loading tasks...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{taskAssigneeFilter ? 'No tasks match the current filter' : 'No tasks yet'}</p>
                <p className="text-sm">{taskAssigneeFilter ? 'Try a different filter or clear the filter' : 'Create tasks to track project progress'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => {
                  const hasSubtasks = task.subtasks && task.subtasks.length > 0
                  const isExpanded = expandedTasks.has(task.id)
                  const subtaskProgress = getSubtaskProgress(task.subtasks || [])

                  return (
                    <div key={task.id} className="space-y-1">
                      <div
                        draggable
                        onDragStart={(e) => handleTaskDragStart(e, task)}
                        onDragEnd={handleTaskDragEnd}
                        onDragOver={(e) => handleTaskDragOver(e, task.id)}
                        onDragLeave={handleTaskDragLeave}
                        onDrop={(e) => handleTaskDrop(e, task)}
                        className={`p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-grab ${
                          draggedTask?.id === task.id ? 'opacity-50 scale-95' : ''
                        } ${dragOverTaskId === task.id ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-5 w-5 text-slate-400 dark:text-slate-600 cursor-grab" />
                              {/* Expand/collapse button for tasks with subtasks */}
                              {hasSubtasks ? (
                                <button
                                  onClick={() => toggleExpand(task.id)}
                                  className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                  aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-5" /> /* Spacer for alignment */
                              )}
                              <button
                                onClick={() => toggleTaskStatus(task)}
                                className={`mt-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                                  task.status === 'done'
                                    ? 'bg-green-500 border-green-500 hover:bg-green-600 hover:border-green-600'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500'
                                }`}
                                aria-label={task.status === 'done' ? 'Mark task as incomplete' : 'Mark task as complete'}
                              >
                                {task.status === 'done' && (
                                  <CheckSquare className="h-3 w-3 text-white" />
                                )}
                              </button>
                            </div>
                            <div className="flex-1">
                              <h4 className={`font-medium text-slate-900 dark:text-white ${
                                task.status === 'done' ? 'line-through text-slate-500' : ''
                              }`}>
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 mt-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                  task.status === 'done' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                  task.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                  'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                  {task.status.replace('_', ' ')}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                  task.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                  task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                  'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                  {task.priority === 'high' && <AlertCircle className="h-3 w-3 mr-1" />}
                                  {task.priority}
                                </span>
                                {task.due_date && (() => {
                                  const dueDate = new Date(task.due_date)
                                  const today = new Date()
                                  today.setHours(0, 0, 0, 0)
                                  dueDate.setHours(0, 0, 0, 0)
                                  const isOverdue = dueDate < today && task.status !== 'done'
                                  const isDueToday = dueDate.getTime() === today.getTime() && task.status !== 'done'

                                  return (
                                    <span className={`text-xs flex items-center ${
                                      isOverdue ? 'text-red-600 dark:text-red-400 font-medium' :
                                      isDueToday ? 'text-amber-600 dark:text-amber-400 font-medium' :
                                      'text-slate-500 dark:text-slate-400'
                                    }`}>
                                      <Calendar className={`h-3 w-3 mr-1 ${
                                        isOverdue ? 'text-red-600 dark:text-red-400' :
                                        isDueToday ? 'text-amber-600 dark:text-amber-400' : ''
                                      }`} />
                                      {isOverdue ? 'Overdue: ' : isDueToday ? 'Due Today: ' : ''}
                                      {dueDate.toLocaleDateString()}
                                    </span>
                                  )
                                })()}
                                {task.assignee && (
                                  <span className="text-xs flex items-center text-slate-500 dark:text-slate-400">
                                    <User className="h-3 w-3 mr-1" />
                                    {task.assignee.full_name || task.assignee.email}
                                  </span>
                                )}
                                {/* Subtask progress indicator */}
                                {hasSubtasks && (
                                  <span className="text-xs flex items-center text-slate-500 dark:text-slate-400">
                                    <CheckSquare className="h-3 w-3 mr-1" />
                                    {subtaskProgress.completed}/{subtaskProgress.total} subtasks
                                  </span>
                                )}
                              </div>
                              {/* Subtask progress bar */}
                              {hasSubtasks && subtaskProgress.total > 0 && (
                                <div className="mt-2 w-full max-w-xs">
                                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        subtaskProgress.percentage === 100 ? 'bg-green-500' : 'bg-primary-500'
                                      }`}
                                      style={{ width: `${subtaskProgress.percentage}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setAddingSubtaskToTaskId(task.id)
                                setSubtaskTitle('')
                              }}
                              className="p-2 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title="Add subtask"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTask(task)
                                setIsEditTaskModalOpen(true)
                              }}
                              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTask(task)
                                setIsDeleteTaskDialogOpen(true)
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Add subtask input (inline) */}
                        {addingSubtaskToTaskId === task.id && (
                          <form onSubmit={(e) => handleAddSubtask(e, task.id)} className="mt-3 ml-14 flex gap-2">
                            <input
                              type="text"
                              value={subtaskTitle}
                              onChange={(e) => setSubtaskTitle(e.target.value)}
                              placeholder="Add subtask..."
                              className="input flex-1 text-sm py-1.5"
                              disabled={addingSubtask}
                              autoFocus
                            />
                            <button
                              type="submit"
                              disabled={addingSubtask || !subtaskTitle.trim()}
                              className="btn-primary text-sm py-1.5 px-3"
                            >
                              {addingSubtask ? 'Adding...' : 'Add'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingSubtaskToTaskId(null)
                                setSubtaskTitle('')
                              }}
                              className="btn-outline text-sm py-1.5 px-3"
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </div>

                      {/* Subtasks list */}
                      {hasSubtasks && isExpanded && (
                        <div className="ml-10 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2">
                          {task.subtasks!.map((subtask) => (
                            <div
                              key={subtask.id}
                              className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-start justify-between"
                            >
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => toggleTaskStatus(subtask)}
                                  className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                                    subtask.status === 'done'
                                      ? 'bg-green-500 border-green-500 hover:bg-green-600 hover:border-green-600'
                                      : 'border-slate-300 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500'
                                  }`}
                                  aria-label={subtask.status === 'done' ? 'Mark subtask as incomplete' : 'Mark subtask as complete'}
                                >
                                  {subtask.status === 'done' && (
                                    <CheckSquare className="h-2.5 w-2.5 text-white" />
                                  )}
                                </button>
                                <div>
                                  <span className={`text-sm ${
                                    subtask.status === 'done'
                                      ? 'line-through text-slate-400 dark:text-slate-500'
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {subtask.title}
                                  </span>
                                  {subtask.due_date && (
                                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                                      <Calendar className="h-3 w-3 inline mr-1" />
                                      {new Date(subtask.due_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedTask(subtask)
                                    setIsEditTaskModalOpen(true)
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedTask(subtask)
                                    setIsDeleteTaskDialogOpen(true)
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        project={project}
        onProjectUpdated={fetchProject}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This action cannot be undone and will also remove all associated tasks.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        project={project}
        onTaskAdded={fetchTasks}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        isOpen={isEditTaskModalOpen}
        onClose={() => {
          setIsEditTaskModalOpen(false)
          setSelectedTask(null)
        }}
        task={selectedTask}
        onTaskUpdated={fetchTasks}
      />

      {/* Delete Task Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteTaskDialogOpen}
        onClose={() => {
          setIsDeleteTaskDialogOpen(false)
          setSelectedTask(null)
        }}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${selectedTask?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deletingTask}
      />

      {/* Add Milestone Modal */}
      <AddMilestoneModal
        isOpen={isAddMilestoneModalOpen}
        onClose={() => setIsAddMilestoneModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        onMilestoneAdded={fetchMilestones}
      />
    </div>
  )
}

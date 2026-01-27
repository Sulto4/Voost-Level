import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Mail, Phone, Globe, Building2, Plus, Calendar, DollarSign, MessageSquare, Users, CheckSquare, Download, Code, Star, User, RotateCcw, Filter, X, Pin, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime } from '../../lib/dateUtils'
import { EditClientModal } from '../../components/clients/EditClientModal'
import { AddProjectModal } from '../../components/projects/AddProjectModal'
import { EditProjectModal } from '../../components/projects/EditProjectModal'
import { LogActivityModal } from '../../components/activities/LogActivityModal'
import { AddContactModal } from '../../components/contacts/AddContactModal'
import { EditContactModal } from '../../components/contacts/EditContactModal'
import { FileUpload } from '../../components/files/FileUpload'
import { FileList } from '../../components/files/FileList'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { useWorkspace } from '../../context/WorkspaceContext'
import type { Client, Project, Activity, ActivityType, ClientContact, File as FileType, LeadScoringConfig } from '../../types/database'
import { getClientContext, type AIContextExport } from '../../services/aiContextService'
import { calculateLeadScore, getScoreColor, getScoreLabel, type LeadScoreResult } from '../../lib/leadScoring'
import { webhookEvents } from '../../services/webhookService'

const tabs = ['Overview', 'Contacts', 'Projects', 'Activity', 'Files']

/**
 * Generates a VCard string from client data
 * VCard 3.0 format: https://tools.ietf.org/html/rfc2426
 */
function generateVCard(client: Client): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
  ]

  // Full name (required)
  lines.push(`FN:${client.name}`)

  // Structured name - N:LastName;FirstName;Middle;Prefix;Suffix
  // We only have the full name, so we'll try to split it
  const nameParts = client.name.trim().split(' ')
  if (nameParts.length > 1) {
    const lastName = nameParts[nameParts.length - 1]
    const firstName = nameParts.slice(0, -1).join(' ')
    lines.push(`N:${lastName};${firstName};;;`)
  } else {
    lines.push(`N:${client.name};;;;`)
  }

  // Organization/Company
  if (client.company) {
    lines.push(`ORG:${client.company}`)
  }

  // Email
  if (client.email) {
    lines.push(`EMAIL;TYPE=WORK:${client.email}`)
  }

  // Phone
  if (client.phone) {
    lines.push(`TEL;TYPE=WORK:${client.phone}`)
  }

  // Website
  if (client.website) {
    lines.push(`URL:${client.website}`)
  }

  // Notes (if any)
  if (client.notes) {
    // VCard notes need special escaping for newlines
    const escapedNotes = client.notes.replace(/\n/g, '\\n').replace(/,/g, '\\,')
    lines.push(`NOTE:${escapedNotes}`)
  }

  // Add timestamps
  lines.push(`REV:${new Date().toISOString()}`)

  lines.push('END:VCARD')

  return lines.join('\r\n')
}

/**
 * Downloads a VCard file for the client
 */
function downloadVCard(client: Client): void {
  const vcardContent = generateVCard(client)
  const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  // Sanitize filename - remove special characters
  const safeName = client.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_')
  a.download = `${safeName}.vcf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generates a VCard string from contact data
 */
function generateContactVCard(contact: ClientContact, companyName?: string): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
  ]

  // Full name (required)
  lines.push(`FN:${contact.name}`)

  // Structured name
  const nameParts = contact.name.trim().split(' ')
  if (nameParts.length > 1) {
    const lastName = nameParts[nameParts.length - 1]
    const firstName = nameParts.slice(0, -1).join(' ')
    lines.push(`N:${lastName};${firstName};;;`)
  } else {
    lines.push(`N:${contact.name};;;;`)
  }

  // Organization and title/role
  if (companyName) {
    lines.push(`ORG:${companyName}`)
  }
  if (contact.role) {
    lines.push(`TITLE:${contact.role}`)
  }

  // Email
  if (contact.email) {
    lines.push(`EMAIL;TYPE=WORK:${contact.email}`)
  }

  // Phone
  if (contact.phone) {
    lines.push(`TEL;TYPE=WORK:${contact.phone}`)
  }

  // Notes
  if (contact.notes) {
    const escapedNotes = contact.notes.replace(/\n/g, '\\n').replace(/,/g, '\\,')
    lines.push(`NOTE:${escapedNotes}`)
  }

  lines.push(`REV:${new Date().toISOString()}`)
  lines.push('END:VCARD')

  return lines.join('\r\n')
}

/**
 * Downloads a VCard file for a contact
 */
function downloadContactVCard(contact: ClientContact, companyName?: string): void {
  const vcardContent = generateContactVCard(contact, companyName)
  const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  const safeName = contact.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_')
  a.download = `${safeName}.vcf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('Overview')

  // Get the URL to navigate back to clients list (preserving filters)
  // If we navigated from clients list with filters, use that URL; otherwise default to /clients
  const clientsListUrl = useRef('/clients')

  useEffect(() => {
    // Check location.state for preserved URL from clients list
    if (location.state && (location.state as { from?: string }).from) {
      clientsListUrl.current = (location.state as { from: string }).from
    }
  }, [])
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false)
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [isLogActivityModalOpen, setIsLogActivityModalOpen] = useState(false)
  const [defaultActivityType, setDefaultActivityType] = useState<ActivityType>('call')
  const [activities, setActivities] = useState<(Activity & { user?: { full_name: string | null; email: string } })[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [showContextModal, setShowContextModal] = useState(false)
  const [contextData, setContextData] = useState<AIContextExport | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false)
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ClientContact | null>(null)
  const [isDeleteContactDialogOpen, setIsDeleteContactDialogOpen] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<ClientContact | null>(null)
  const [deletingContact, setDeletingContact] = useState(false)
  const [files, setFiles] = useState<(FileType & { uploader?: { full_name: string | null; email: string } })[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [activityTypeFilter, setActivityTypeFilter] = useState<ActivityType | null>(null)
  const [activityUserFilter, setActivityUserFilter] = useState<string | null>(null)
  const [isActivityFilterDropdownOpen, setIsActivityFilterDropdownOpen] = useState(false)
  const activityFilterRef = useRef<HTMLDivElement>(null)
  // Activity pagination with infinite scroll
  const ACTIVITIES_PAGE_SIZE = 10
  const [activitiesHasMore, setActivitiesHasMore] = useState(false)
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false)
  const activitiesEndRef = useRef<HTMLDivElement>(null)
  const { currentWorkspace, currentRole } = useWorkspace()
  const canEdit = currentRole !== 'viewer'

  // Lead scoring state
  const [leadScore, setLeadScore] = useState<LeadScoreResult | null>(null)
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)

  // Favorites functionality (per-user, stored in localStorage)
  const [isFavorite, setIsFavorite] = useState(false)

  // Load favorite status on mount
  useEffect(() => {
    if (!id) return
    const savedFavorites = localStorage.getItem('favoriteClientIds')
    if (savedFavorites) {
      try {
        const favIds = JSON.parse(savedFavorites) as string[]
        setIsFavorite(favIds.includes(id))
      } catch {
        console.error('Failed to load favorite clients')
      }
    }
  }, [id])

  // Toggle favorite status
  function toggleFavorite() {
    if (!id) return
    const savedFavorites = localStorage.getItem('favoriteClientIds')
    let favIds: string[] = []
    if (savedFavorites) {
      try {
        favIds = JSON.parse(savedFavorites) as string[]
      } catch {
        favIds = []
      }
    }
    if (isFavorite) {
      // Remove from favorites
      favIds = favIds.filter(fid => fid !== id)
    } else {
      // Add to favorites
      favIds.push(id)
    }
    localStorage.setItem('favoriteClientIds', JSON.stringify(favIds))
    setIsFavorite(!isFavorite)
  }

  // Pin to Dashboard functionality (stored in localStorage)
  const [isPinned, setIsPinned] = useState(false)

  // Load pinned status on mount
  useEffect(() => {
    if (!id) return
    const savedPinned = localStorage.getItem('pinnedClientIds')
    if (savedPinned) {
      try {
        const pinIds = JSON.parse(savedPinned) as string[]
        setIsPinned(pinIds.includes(id))
      } catch {
        console.error('Failed to load pinned clients')
      }
    }
  }, [id])

  // Toggle pin to dashboard
  function togglePin() {
    if (!id) return
    const savedPinned = localStorage.getItem('pinnedClientIds')
    let pinIds: string[] = []
    if (savedPinned) {
      try {
        pinIds = JSON.parse(savedPinned) as string[]
      } catch {
        pinIds = []
      }
    }
    if (isPinned) {
      // Remove from pinned
      pinIds = pinIds.filter(pid => pid !== id)
    } else {
      // Add to pinned
      pinIds.push(id)
    }
    localStorage.setItem('pinnedClientIds', JSON.stringify(pinIds))
    setIsPinned(!isPinned)
  }

  useEffect(() => {
    if (id) {
      fetchClient()
      fetchProjects()
      fetchActivities()
      fetchContacts()
      fetchFiles()
    }
  }, [id])

  // Calculate lead score when client, projects, activities, or workspace changes
  useEffect(() => {
    if (client && currentWorkspace) {
      const settings = currentWorkspace.settings as { leadScoring?: LeadScoringConfig } | null
      const config = settings?.leadScoring

      // Check if there are projects
      const hasProjects = projects.length > 0

      // Check for recent activity (within last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const hasRecentActivity = activities.some(a => new Date(a.created_at) >= thirtyDaysAgo)

      const score = calculateLeadScore(client, config, {
        hasProjects,
        hasRecentActivity,
      })
      setLeadScore(score)
    } else {
      setLeadScore(null)
    }
  }, [client, projects, activities, currentWorkspace])

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

  async function fetchActivities(loadMore = false) {
    if (!id) return

    if (loadMore) {
      setLoadingMoreActivities(true)
    } else {
      setActivitiesLoading(true)
    }

    const offset = loadMore ? activities.length : 0

    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        user:profiles!user_id(full_name, email)
      `)
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + ACTIVITIES_PAGE_SIZE - 1)

    if (error) {
      console.error('Error fetching activities:', error)
    } else {
      const newActivities = data || []
      if (loadMore) {
        setActivities(prev => [...prev, ...newActivities])
      } else {
        setActivities(newActivities)
      }
      // Check if there are more activities to load
      setActivitiesHasMore(newActivities.length === ACTIVITIES_PAGE_SIZE)
    }

    if (loadMore) {
      setLoadingMoreActivities(false)
    } else {
      setActivitiesLoading(false)
    }
  }

  async function fetchContacts() {
    if (!id) return
    setContactsLoading(true)
    const { data, error } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', id)
      .order('is_primary', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching contacts:', error)
    } else {
      setContacts(data || [])
    }
    setContactsLoading(false)
  }

  async function fetchFiles() {
    if (!id) return
    setFilesLoading(true)
    const { data, error } = await supabase
      .from('files')
      .select(`
        *,
        uploader:profiles!uploaded_by(full_name, email)
      `)
      .eq('client_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching files:', error)
    } else {
      setFiles(data || [])
    }
    setFilesLoading(false)
  }

  function openLogActivity(type: ActivityType = 'call') {
    setDefaultActivityType(type)
    setIsLogActivityModalOpen(true)
  }

  async function handleDeleteContact() {
    if (!contactToDelete) return

    setDeletingContact(true)
    const { error } = await supabase
      .from('client_contacts')
      .delete()
      .eq('id', contactToDelete.id)

    if (error) {
      console.error('Error deleting contact:', error)
    } else {
      await fetchContacts()
    }
    setDeletingContact(false)
    setIsDeleteContactDialogOpen(false)
    setContactToDelete(null)
  }

  async function handleExportAIContext() {
    if (!id) return
    setContextLoading(true)
    const { data, error } = await getClientContext(id)
    if (error) {
      console.error('Error exporting AI context:', error)
    } else {
      setContextData(data)
      setShowContextModal(true)
    }
    setContextLoading(false)
  }

  function downloadContextAsJSON() {
    if (!contextData) return
    const blob = new Blob([JSON.stringify(contextData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `client-${contextData.client.id}-context.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function copyContextToClipboard() {
    if (!contextData) return
    navigator.clipboard.writeText(JSON.stringify(contextData, null, 2))
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

  const activityTypeOptions: { value: ActivityType; label: string }[] = [
    { value: 'call', label: 'Calls' },
    { value: 'email', label: 'Emails' },
    { value: 'meeting', label: 'Meetings' },
    { value: 'note', label: 'Notes' },
    { value: 'task', label: 'Tasks' },
    { value: 'status_change', label: 'Status Changes' },
  ]

  // Get unique users from activities for filter dropdown
  const activityUsers = Array.from(
    new Map(
      activities
        .filter(a => a.user)
        .map(a => [a.user_id, { id: a.user_id, name: a.user?.full_name || a.user?.email || 'Unknown' }])
    ).values()
  )

  // Filter activities by type and user
  const filteredActivities = activities.filter(activity => {
    if (activityTypeFilter && activity.type !== activityTypeFilter) return false
    if (activityUserFilter && activity.user_id !== activityUserFilter) return false
    return true
  })

  // Count active filters
  const activeFilterCount = (activityTypeFilter ? 1 : 0) + (activityUserFilter ? 1 : 0)

  // Close activity filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (activityFilterRef.current && !activityFilterRef.current.contains(event.target as Node)) {
        setIsActivityFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Infinite scroll for activities - load more when sentinel comes into view
  useEffect(() => {
    const sentinel = activitiesEndRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        // Load more when sentinel is visible and we have more to load
        if (entry.isIntersecting && activitiesHasMore && !loadingMoreActivities && !activityTypeFilter && !activityUserFilter) {
          fetchActivities(true)
        }
      },
      {
        root: null, // viewport
        rootMargin: '100px', // trigger 100px before reaching the sentinel
        threshold: 0.1,
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [activitiesHasMore, loadingMoreActivities, activityTypeFilter, activityUserFilter, activities.length])

  async function handleDelete() {
    if (!client) return

    setDeleting(true)
    // Soft delete by setting deleted_at timestamp
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', client.id)

    if (error) {
      console.error('Error deleting client:', error)
      setDeleting(false)
    } else {
      // Trigger webhooks for client.deleted event
      if (currentWorkspace) {
        webhookEvents.clientDeleted(currentWorkspace.id, client).catch(console.error)
      }
      // Navigate back to clients list
      navigate('/clients')
    }
  }

  async function handleRestore() {
    if (!client) return

    setRestoring(true)
    // Clear deleted_at to restore the client
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: null })
      .eq('id', client.id)

    if (error) {
      console.error('Error restoring client:', error)
      setRestoring(false)
    } else {
      // Refresh client data to show updated state
      await fetchClient()
      setRestoring(false)
    }
  }

  // Check if client is deleted (archived)
  const isDeleted = client?.deleted_at !== null && client?.deleted_at !== undefined

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
      {/* Deleted/Archived Banner */}
      {isDeleted && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <Trash2 className="h-5 w-5 text-red-500 dark:text-red-400 mr-3" />
            <span className="text-red-700 dark:text-red-300">
              This client has been deleted. Click "Restore" to bring it back to the active clients list.
            </span>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Clients', href: clientsListUrl.current },
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                {client.name}
              </h1>
              <button
                onClick={toggleFavorite}
                className={`flex-shrink-0 p-1.5 rounded-full transition-colors ${
                  isFavorite
                    ? 'text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                    : 'text-slate-400 hover:text-yellow-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={`h-5 w-5 ${isFavorite ? 'fill-yellow-500' : ''}`} />
              </button>
            </div>
            {client.company && (
              <p className="text-slate-500 dark:text-slate-400 truncate">{client.company}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={togglePin}
            className={`btn-outline ${isPinned ? 'text-primary-600 border-primary-300 dark:border-primary-700' : ''}`}
            title={isPinned ? 'Unpin from dashboard' : 'Pin to dashboard'}
          >
            <Pin className={`h-4 w-4 sm:mr-2 ${isPinned ? 'fill-primary-500' : ''}`} />
            <span className="hidden sm:inline">{isPinned ? 'Pinned' : 'Pin'}</span>
          </button>
          <button
            onClick={handleExportAIContext}
            disabled={contextLoading}
            className="btn-outline"
            title="Export AI Context"
          >
            {contextLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600 sm:mr-2" />
            ) : (
              <Code className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">AI Context</span>
          </button>
          {canEdit && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="btn-outline"
            >
              <Edit className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
          {canEdit && isDeleted && (
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="btn-outline text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
            >
              {restoring ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-300 border-t-green-600 sm:mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Restore</span>
            </button>
          )}
          {canEdit && !isDeleted && (
            <button
              onClick={() => setIsDeleteDialogOpen(true)}
              className="btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
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

                  {/* Download VCard button */}
                  {(client.email || client.phone || client.company) && (
                    <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => downloadVCard(client)}
                        className="btn-outline text-sm flex items-center"
                        title="Download contact as VCard"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download VCard
                      </button>
                    </div>
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

            {/* Lead Score Section */}
            {leadScore && leadScore.maxScore > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary-500" />
                    Lead Score
                  </h2>
                  <button
                    onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                    className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
                  >
                    {showScoreBreakdown ? 'Hide' : 'Show'} breakdown
                    {showScoreBreakdown ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      'text-3xl font-bold px-4 py-2 rounded-lg',
                      getScoreColor(leadScore.percentage)
                    )}>
                      {leadScore.score}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          {getScoreLabel(leadScore.percentage)} Lead
                        </span>
                        <span className="text-sm text-slate-500">
                          {leadScore.score} / {leadScore.maxScore} points ({leadScore.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                        <div
                          className={clsx(
                            'h-2.5 rounded-full transition-all',
                            leadScore.percentage >= 80 ? 'bg-green-500' :
                            leadScore.percentage >= 60 ? 'bg-emerald-500' :
                            leadScore.percentage >= 40 ? 'bg-yellow-500' :
                            leadScore.percentage >= 20 ? 'bg-orange-500' : 'bg-red-500'
                          )}
                          style={{ width: `${leadScore.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  {showScoreBreakdown && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                        Score Breakdown
                      </h4>
                      <div className="space-y-2">
                        {leadScore.breakdown.map((item, index) => {
                          const criteriaLabels: Record<string, string> = {
                            'has_email': 'Has Email',
                            'has_phone': 'Has Phone',
                            'has_company': 'Has Company',
                            'has_website': 'Has Website',
                            'has_value': 'Has Deal Value',
                            'value_above': `Deal Value ≥ $${item.rule.value ? Number(item.rule.value).toLocaleString() : '0'}`,
                            'source_equals': `Source = ${item.rule.value || 'N/A'}`,
                            'has_projects': 'Has Projects',
                            'recent_activity': 'Recent Activity (30 days)',
                          }
                          return (
                            <div
                              key={index}
                              className={clsx(
                                'flex items-center justify-between py-1.5 px-2 rounded',
                                item.matched
                                  ? 'bg-green-50 dark:bg-green-900/20'
                                  : 'bg-slate-100 dark:bg-slate-800'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className={clsx(
                                  'w-4 h-4 rounded-full flex items-center justify-center text-xs',
                                  item.matched
                                    ? 'bg-green-500 text-white'
                                    : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                                )}>
                                  {item.matched ? '✓' : '×'}
                                </span>
                                <span className={clsx(
                                  'text-sm',
                                  item.matched
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-slate-500 dark:text-slate-400'
                                )}>
                                  {criteriaLabels[item.rule.type] || item.rule.type}
                                </span>
                              </div>
                              <span className={clsx(
                                'text-sm font-medium',
                                item.matched
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-slate-400 dark:text-slate-500'
                              )}>
                                {item.matched ? `+${item.points}` : `+0 / ${item.rule.points}`}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom Fields Section */}
            {client.custom_fields && typeof client.custom_fields === 'object' && Object.keys(client.custom_fields).length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Custom Fields
                </h2>
                <dl className="space-y-3">
                  {Object.entries(client.custom_fields as Record<string, string>).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-sm text-slate-500 dark:text-slate-400">{key}</dt>
                      <dd className="text-slate-900 dark:text-white">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Notes Section */}
            {client.notes && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Notes
                </h2>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  {/* Support rich text notes by rendering HTML if it contains tags */}
                  {/<[^>]+>/.test(client.notes) ? (
                    <div
                      className="text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&_a]:text-primary-600 [&_a]:dark:text-primary-400"
                      dangerouslySetInnerHTML={{ __html: client.notes }}
                    />
                  ) : (
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {client.notes}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'Contacts' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Contacts ({contacts.length})
              </h2>
              {canEdit && (
                <button
                  onClick={() => setIsAddContactModalOpen(true)}
                  className="btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </button>
              )}
            </div>
            {contactsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-slate-500 dark:text-slate-400">Loading contacts...</p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No contacts yet</p>
                <p className="text-sm mt-2">Add contacts to keep track of people at this client.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                          {contact.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-slate-900 dark:text-white">
                              {contact.name}
                            </h4>
                            {contact.is_primary && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                <Star className="h-3 w-3 mr-1 fill-current" />
                                Primary
                              </span>
                            )}
                          </div>
                          {contact.role && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {contact.role}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                            {contact.email && (
                              <a
                                href={`mailto:${contact.email}`}
                                className="flex items-center text-slate-600 dark:text-slate-300 hover:text-primary-600"
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                {contact.email}
                              </a>
                            )}
                            {contact.phone && (
                              <a
                                href={`tel:${contact.phone}`}
                                className="flex items-center text-slate-600 dark:text-slate-300 hover:text-primary-600"
                              >
                                <Phone className="h-4 w-4 mr-1" />
                                {contact.phone}
                              </a>
                            )}
                          </div>
                          {contact.notes && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                              {contact.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* Download VCard button - available to all users */}
                        <button
                          onClick={() => downloadContactVCard(contact, client.company || undefined)}
                          className="btn-outline p-2 min-w-[44px] min-h-[44px]"
                          title="Download VCard"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedContact(contact)
                                setIsEditContactModalOpen(true)
                              }}
                              className="btn-outline p-2 min-w-[44px] min-h-[44px]"
                              title="Edit contact"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setContactToDelete(contact)
                                setIsDeleteContactDialogOpen(true)
                              }}
                              className="btn-outline p-2 min-w-[44px] min-h-[44px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete contact"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
              {canEdit && (
                <button
                  onClick={() => setIsAddProjectModalOpen(true)}
                  className="btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Project
                </button>
              )}
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
                      {canEdit && (
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'Activity' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Activity Timeline
                {activities.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                    ({filteredActivities.length}{(activityTypeFilter || activityUserFilter) && ` of ${activities.length}`}{activitiesHasMore && '+'})
                  </span>
                )}
              </h2>
              <div className="flex gap-2 flex-wrap">
                {/* Activity Filter */}
                <div className="relative" ref={activityFilterRef}>
                  <button
                    onClick={() => setIsActivityFilterDropdownOpen(!isActivityFilterDropdownOpen)}
                    className={clsx(
                      'btn-outline flex items-center',
                      activeFilterCount > 0 && 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                    )}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                    {activeFilterCount > 0 && (
                      <span className="ml-2 h-5 w-5 flex items-center justify-center bg-primary-600 text-white text-xs rounded-full">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {/* Filter Dropdown */}
                  {isActivityFilterDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                      {/* Clear All Filters */}
                      {activeFilterCount > 0 && (
                        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => {
                              setActivityTypeFilter(null)
                              setActivityUserFilter(null)
                            }}
                            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                          >
                            Clear all filters
                          </button>
                        </div>
                      )}

                      {/* Activity Type Section */}
                      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Activity Type</span>
                          {activityTypeFilter && (
                            <button
                              onClick={() => setActivityTypeFilter(null)}
                              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {activityTypeOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setActivityTypeFilter(activityTypeFilter === option.value ? null : option.value)
                              }}
                              className={clsx(
                                'w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between',
                                activityTypeFilter === option.value
                                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              )}
                            >
                              <span className="flex items-center">
                                {(() => {
                                  const Icon = activityIcons[option.value]
                                  return <Icon className="h-4 w-4 mr-2" />
                                })()}
                                {option.label}
                              </span>
                              {activityTypeFilter === option.value && (
                                <span className="text-primary-600 dark:text-primary-400">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* User Filter Section */}
                      {activityUsers.length > 0 && (
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Team Member</span>
                            {activityUserFilter && (
                              <button
                                onClick={() => setActivityUserFilter(null)}
                                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            {activityUsers.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => {
                                  setActivityUserFilter(activityUserFilter === user.id ? null : user.id)
                                }}
                                className={clsx(
                                  'w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between',
                                  activityUserFilter === user.id
                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                )}
                              >
                                <span className="flex items-center">
                                  <User className="h-4 w-4 mr-2" />
                                  {user.name}
                                </span>
                                {activityUserFilter === user.id && (
                                  <span className="text-primary-600 dark:text-primary-400">✓</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {canEdit && (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Active Filter Chips */}
            {(activityTypeFilter || activityUserFilter) && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-sm text-slate-500 dark:text-slate-400">Filtering by:</span>
                {activityTypeFilter && (
                  <span className={clsx(
                    'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                    activityColors[activityTypeFilter]
                  )}>
                    {activityTypeOptions.find(o => o.value === activityTypeFilter)?.label}
                    <button
                      onClick={() => setActivityTypeFilter(null)}
                      className="ml-2 hover:opacity-70"
                      aria-label="Clear type filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {activityUserFilter && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    <User className="h-3 w-3 mr-1.5" />
                    {activityUsers.find(u => u.id === activityUserFilter)?.name || 'Unknown'}
                    <button
                      onClick={() => setActivityUserFilter(null)}
                      className="ml-2 hover:opacity-70"
                      aria-label="Clear user filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {activeFilterCount > 1 && (
                  <button
                    onClick={() => {
                      setActivityTypeFilter(null)
                      setActivityUserFilter(null)
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 ml-2"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
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
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No activities match the current {activeFilterCount > 1 ? 'filters' : 'filter'}</p>
                <button
                  onClick={() => {
                    setActivityTypeFilter(null)
                    setActivityUserFilter(null)
                  }}
                  className="text-sm mt-2 text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  Clear {activeFilterCount > 1 ? 'filters' : 'filter'} to see all activities
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredActivities.map((activity) => {
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
                          /* Support rich text content by rendering HTML if it contains tags */
                          /<[^>]+>/.test(activity.content) ? (
                            <div
                              className="text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&_a]:text-primary-600 [&_a]:dark:text-primary-400"
                              dangerouslySetInnerHTML={{ __html: activity.content }}
                            />
                          ) : (
                            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                              {activity.content}
                            </p>
                          )
                        )}
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2" title={new Date(activity.created_at).toLocaleString()}>
                          {formatRelativeTime(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {/* Infinite scroll sentinel and loading indicator */}
                {!activityTypeFilter && !activityUserFilter && (
                  <div ref={activitiesEndRef} className="pt-4">
                    {loadingMoreActivities && (
                      <div className="flex justify-center items-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                        <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading more activities...</span>
                      </div>
                    )}
                    {activitiesHasMore && !loadingMoreActivities && (
                      <div className="text-center">
                        <button
                          onClick={() => fetchActivities(true)}
                          className="btn-outline"
                        >
                          Load More Activities
                        </button>
                      </div>
                    )}
                    {!activitiesHasMore && activities.length > ACTIVITIES_PAGE_SIZE && (
                      <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">
                        You've reached the end of the activity timeline
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {activeTab === 'Files' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Files ({files.length})
              </h2>
            </div>
            {currentWorkspace && canEdit && (
              <FileUpload
                clientId={client.id}
                workspaceId={currentWorkspace.id}
                onUploadComplete={fetchFiles}
              />
            )}
            <FileList
              files={files}
              loading={filesLoading}
              onFileDeleted={fetchFiles}
              canEdit={canEdit}
            />
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

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddContactModalOpen}
        onClose={() => setIsAddContactModalOpen(false)}
        clientId={client.id}
        onContactAdded={fetchContacts}
      />

      {/* Edit Contact Modal */}
      <EditContactModal
        isOpen={isEditContactModalOpen}
        onClose={() => {
          setIsEditContactModalOpen(false)
          setSelectedContact(null)
        }}
        contact={selectedContact}
        onContactUpdated={fetchContacts}
      />

      {/* Delete Contact Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteContactDialogOpen}
        onClose={() => {
          setIsDeleteContactDialogOpen(false)
          setContactToDelete(null)
        }}
        onConfirm={handleDeleteContact}
        title="Delete Contact"
        message={`Are you sure you want to delete "${contactToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deletingContact}
      />

      {/* AI Context Export Modal */}
      {showContextModal && contextData && (
        <div className="fixed inset-0 z-50 overflow-y-auto" data-testid="ai-context-modal">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-slate-500/75 dark:bg-slate-900/75" onClick={() => setShowContextModal(false)} />

            <div className="relative inline-block w-full max-w-4xl p-6 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-xl rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  AI Context Export
                </h3>
                <button
                  onClick={() => setShowContextModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Projects</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white">{contextData.summary.total_projects}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Active</div>
                  <div className="text-xl font-semibold text-green-600 dark:text-green-400">{contextData.summary.active_projects}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Activities</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white">{contextData.summary.total_activities}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Value</div>
                  <div className="text-xl font-semibold text-slate-900 dark:text-white">
                    {contextData.summary.total_value ? `$${contextData.summary.total_value.toLocaleString()}` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* JSON Preview */}
              <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-80">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap" data-testid="ai-context-json">
                  {JSON.stringify(contextData, null, 2)}
                </pre>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={copyContextToClipboard}
                  className="btn-outline"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={downloadContextAsJSON}
                  className="btn-primary"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

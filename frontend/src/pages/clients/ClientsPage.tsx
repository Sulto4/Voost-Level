import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, Filter, MoreHorizontal, Building2, Mail, Phone, ChevronLeft, ChevronRight, X, Download, Upload, Trash2, CheckSquare, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Save, FolderOpen, RotateCcw, Archive, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { AddClientModal } from '../../components/clients/AddClientModal'
import { ImportClientsModal } from '../../components/clients/ImportClientsModal'
import { ClientTableSkeleton } from '../../components/ui/Skeleton'
import { PullToRefresh } from '../../components/ui/PullToRefresh'
import type { Client, ClientStatus, LeadScoringConfig } from '../../types/database'
import { calculateLeadScore, getScoreColor, getScoreLabel } from '../../lib/leadScoring'

const ITEMS_PER_PAGE = 20

type DateFilter = 'today' | 'this_week' | 'this_month' | null
type SortField = 'name' | 'created_at' | 'value' | 'status' | 'score'
type SortDirection = 'asc' | 'desc'

interface FilterPreset {
  id: string
  name: string
  statusFilter: ClientStatus | null
  dateFilter: DateFilter
  sourceFilter: string | null
  createdAt: string
}

/**
 * Helper function to highlight matching text in search results
 * Returns JSX elements with highlighted spans for matches
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !text) return text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) return text

  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)

  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded px-0.5">{match}</mark>
      {highlightMatch(after, query)}
    </>
  )
}

export function ClientsPage() {
  const { currentWorkspace, currentRole } = useWorkspace()
  const canEdit = currentRole !== 'viewer'
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Initialize filters from URL params synchronously to avoid race conditions
  const [statusFilter, setStatusFilter] = useState<ClientStatus | null>(() => {
    const statusParam = searchParams.get('status')
    if (statusParam && ['lead', 'active', 'inactive', 'churned'].includes(statusParam)) {
      return statusParam as ClientStatus
    }
    return null
  })
  const [dateFilter, setDateFilter] = useState<DateFilter>(null)
  const [sourceFilter, setSourceFilter] = useState<string | null>(() => {
    return searchParams.get('source') || null
  })
  const [availableSources, setAvailableSources] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(() => {
    return !!searchParams.get('status') || !!searchParams.get('source')
  })
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)
  const [showDeletedClients, setShowDeletedClients] = useState(false)
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null)
  const [isPermanentDeleteModalOpen, setIsPermanentDeleteModalOpen] = useState(false)
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false)
  const [permanentDeleteSuccess, setPermanentDeleteSuccess] = useState<string | null>(null)

  // Filter presets state
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([])
  const [showSavePresetModal, setShowSavePresetModal] = useState(false)
  const [showLoadPresetModal, setShowLoadPresetModal] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [presetError, setPresetError] = useState('')
  const [showExportDropdown, setShowExportDropdown] = useState(false)

  // Recent searches state
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showRecentSearches, setShowRecentSearches] = useState(false)

  // Favorites state
  const [favoriteClientIds, setFavoriteClientIds] = useState<Set<string>>(new Set())
  const [favoritesFilter, setFavoritesFilter] = useState(false)

  // Search suggestions state
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)

  // Handle ?action=add query parameter to open Add Client modal from command palette
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true)
      // Clear the query parameter to avoid reopening on refresh
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Initialize filters from URL query params
  useEffect(() => {
    const statusParam = searchParams.get('status')
    const sourceParam = searchParams.get('source')

    if (statusParam && ['lead', 'active', 'inactive', 'churned'].includes(statusParam)) {
      setStatusFilter(statusParam as ClientStatus)
      setShowFilters(true)
    } else if (!statusParam && statusFilter) {
      // URL has no status param but we have a filter - URL takes precedence
      // This handles fresh navigation
    }

    if (sourceParam) {
      setSourceFilter(sourceParam)
      setShowFilters(true)
    }
  }, [searchParams]) // Re-run when URL params change

  // Sync filters to URL params
  useEffect(() => {
    const newParams = new URLSearchParams()

    if (statusFilter) {
      newParams.set('status', statusFilter)
    }
    if (sourceFilter) {
      newParams.set('source', sourceFilter)
    }

    // Only update if params actually changed to avoid infinite loops
    const currentParamsStr = searchParams.toString()
    const newParamsStr = newParams.toString()

    if (currentParamsStr !== newParamsStr) {
      setSearchParams(newParams, { replace: true })
    }
  }, [statusFilter, sourceFilter])

  // Load saved filter presets from localStorage on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('clientFilterPresets')
    if (savedPresets) {
      try {
        setFilterPresets(JSON.parse(savedPresets))
      } catch {
        console.error('Failed to load filter presets')
      }
    }
  }, [])

  // Save filter presets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('clientFilterPresets', JSON.stringify(filterPresets))
  }, [filterPresets])

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const savedRecentSearches = localStorage.getItem('clientRecentSearches')
    if (savedRecentSearches) {
      try {
        setRecentSearches(JSON.parse(savedRecentSearches))
      } catch {
        console.error('Failed to load recent searches')
      }
    }
  }, [])

  // Load favorite client IDs from localStorage on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favoriteClientIds')
    if (savedFavorites) {
      try {
        const favIds = JSON.parse(savedFavorites) as string[]
        setFavoriteClientIds(new Set(favIds))
      } catch {
        console.error('Failed to load favorite clients')
      }
    }
  }, [])

  // Save favorite client IDs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('favoriteClientIds', JSON.stringify(Array.from(favoriteClientIds)))
  }, [favoriteClientIds])

  // Save recent searches to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('clientRecentSearches', JSON.stringify(recentSearches))
  }, [recentSearches])

  // Add search to recent searches
  function addToRecentSearches(query: string) {
    if (!query.trim()) return
    const trimmedQuery = query.trim()
    // Remove if already exists and add to front
    const updatedSearches = [
      trimmedQuery,
      ...recentSearches.filter(s => s.toLowerCase() !== trimmedQuery.toLowerCase())
    ].slice(0, 5) // Keep only last 5 searches
    setRecentSearches(updatedSearches)
  }

  // Clear a specific recent search
  function removeRecentSearch(query: string) {
    setRecentSearches(recentSearches.filter(s => s !== query))
  }

  // Clear all recent searches
  function clearRecentSearches() {
    setRecentSearches([])
  }

  // Toggle a client as favorite
  function toggleFavorite(clientId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setFavoriteClientIds(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  // Generate search suggestions based on current query
  function getSearchSuggestions(): string[] {
    if (!searchQuery.trim() || searchQuery.trim().length < 1) return []

    const query = searchQuery.trim().toLowerCase()
    const suggestions = new Set<string>()

    // Search through clients for matching names, companies, emails
    clients.forEach(client => {
      if (client.name.toLowerCase().includes(query)) {
        suggestions.add(client.name)
      }
      if (client.company?.toLowerCase().includes(query)) {
        suggestions.add(client.company)
      }
      if (client.email?.toLowerCase().includes(query)) {
        suggestions.add(client.email)
      }
    })

    // Return up to 5 suggestions
    return Array.from(suggestions).slice(0, 5)
  }

  const searchSuggestions = getSearchSuggestions()

  // Save current filters as a preset
  function saveFilterPreset() {
    if (!newPresetName.trim()) {
      setPresetError('Please enter a preset name')
      return
    }

    // Check for duplicate names
    if (filterPresets.some(p => p.name.toLowerCase() === newPresetName.trim().toLowerCase())) {
      setPresetError('A preset with this name already exists')
      return
    }

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      statusFilter,
      dateFilter,
      sourceFilter,
      createdAt: new Date().toISOString()
    }

    setFilterPresets([...filterPresets, newPreset])
    setNewPresetName('')
    setPresetError('')
    setShowSavePresetModal(false)
  }

  // Load a saved filter preset
  function loadFilterPreset(preset: FilterPreset) {
    setStatusFilter(preset.statusFilter)
    setDateFilter(preset.dateFilter)
    setSourceFilter(preset.sourceFilter)
    setShowLoadPresetModal(false)
  }

  // Delete a filter preset
  function deleteFilterPreset(presetId: string) {
    setFilterPresets(filterPresets.filter(p => p.id !== presetId))
  }

  // Check if any filter is active
  const hasActiveFilters = statusFilter !== null || dateFilter !== null || sourceFilter !== null || favoritesFilter

  // Get date range based on filter (timezone-aware using local dates)
  function getDateRange(filter: DateFilter): { start: string; end: string } | null {
    if (!filter) return null

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (filter === 'today') {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return {
        start: today.toISOString(),
        end: tomorrow.toISOString()
      }
    }

    if (filter === 'this_week') {
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay()) // Sunday
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 7)
      return {
        start: startOfWeek.toISOString(),
        end: endOfWeek.toISOString()
      }
    }

    if (filter === 'this_month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      return {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString()
      }
    }

    return null
  }

  useEffect(() => {
    if (currentWorkspace) {
      fetchClients()
      fetchAvailableSources()
    }
  }, [currentWorkspace, currentPage, statusFilter, dateFilter, sourceFilter, sortField, sortDirection, showDeletedClients])

  // Supabase Realtime subscription for live updates
  useEffect(() => {
    if (!currentWorkspace) return

    const channel = supabase
      .channel(`clients:${currentWorkspace.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'clients',
          filter: `workspace_id=eq.${currentWorkspace.id}`
        },
        (payload) => {
          console.log('Realtime client change:', payload.eventType, payload)

          if (payload.eventType === 'INSERT') {
            // Add new client to the list if we're on page 1 and not in deleted view
            if (currentPage === 1 && !showDeletedClients && !payload.new.deleted_at) {
              setClients(prev => {
                // Check if client already exists (avoid duplicates)
                if (prev.some(c => c.id === payload.new.id)) return prev
                // Add to beginning of list
                const newClients = [payload.new as Client, ...prev]
                // Trim to page size
                return newClients.slice(0, ITEMS_PER_PAGE)
              })
              setTotalCount(prev => prev + 1)
            } else {
              // Refresh to get accurate data
              fetchClients()
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update existing client in the list
            setClients(prev => prev.map(client =>
              client.id === payload.new.id ? payload.new as Client : client
            ))
          } else if (payload.eventType === 'DELETE') {
            // Remove client from the list
            setClients(prev => prev.filter(client => client.id !== payload.old.id))
            setTotalCount(prev => Math.max(0, prev - 1))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentWorkspace, currentPage, showDeletedClients])

  // Fetch unique sources for the filter dropdown
  async function fetchAvailableSources() {
    if (!currentWorkspace) return

    const { data, error } = await supabase
      .from('clients')
      .select('source')
      .eq('workspace_id', currentWorkspace.id)
      .not('source', 'is', null)

    if (!error && data) {
      const uniqueSources = [...new Set(data.map(c => c.source).filter(Boolean))] as string[]
      setAvailableSources(uniqueSources.sort())
    }
  }

  // Reset to page 1 when search query or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, dateFilter, sourceFilter])

  async function fetchClients() {
    if (!currentWorkspace) return

    setLoading(true)

    // Build the base query for count
    let countQuery = supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', currentWorkspace.id)

    // Filter by deleted status
    if (showDeletedClients) {
      countQuery = countQuery.not('deleted_at', 'is', null)
    } else {
      countQuery = countQuery.is('deleted_at', null)
    }

    // Apply status filter to count query
    if (statusFilter) {
      countQuery = countQuery.eq('status', statusFilter)
    }

    // Apply date filter to count query
    const dateRange = getDateRange(dateFilter)
    if (dateRange) {
      countQuery = countQuery.gte('created_at', dateRange.start).lt('created_at', dateRange.end)
    }

    // Apply source filter to count query
    if (sourceFilter) {
      countQuery = countQuery.eq('source', sourceFilter)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Error fetching client count:', countError)
    } else {
      setTotalCount(count || 0)
    }

    // Build the base query for data
    const from = (currentPage - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    let dataQuery = supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)

    // Filter by deleted status
    if (showDeletedClients) {
      dataQuery = dataQuery.not('deleted_at', 'is', null)
    } else {
      dataQuery = dataQuery.is('deleted_at', null)
    }

    // Apply status filter to data query
    if (statusFilter) {
      dataQuery = dataQuery.eq('status', statusFilter)
    }

    // Apply date filter to data query
    if (dateRange) {
      dataQuery = dataQuery.gte('created_at', dateRange.start).lt('created_at', dateRange.end)
    }

    // Apply source filter to data query
    if (sourceFilter) {
      dataQuery = dataQuery.eq('source', sourceFilter)
    }

    // For score sorting, we need to sort client-side after fetching
    // For other fields, use Supabase's built-in sorting
    if (sortField !== 'score') {
      dataQuery = dataQuery.order(sortField, { ascending: sortDirection === 'asc' })
    } else {
      // Default sort by created_at for score sorting (will re-sort client-side)
      dataQuery = dataQuery.order('created_at', { ascending: false })
    }

    const { data, error } = await dataQuery.range(from, to)

    if (error) {
      console.error('Error fetching clients:', error)
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }

  // Get lead scoring config for client-side score calculations
  const leadScoringConfig = (currentWorkspace?.settings as { leadScoring?: LeadScoringConfig } | null)?.leadScoring

  // Filter and optionally sort by score
  const filteredClientsBase = clients.filter((client) => {
    // Apply favorites filter
    if (favoritesFilter && !favoriteClientIds.has(client.id)) {
      return false
    }

    const query = searchQuery.trim().toLowerCase()
    if (!query) return true // Show all clients when search is empty or only spaces
    return (
      client.name.toLowerCase().includes(query) ||
      client.company?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.source?.toLowerCase().includes(query)
    )
  })

  // Sort by score client-side when sortField is 'score'
  const filteredClients = sortField === 'score' && leadScoringConfig?.enabled
    ? [...filteredClientsBase].sort((a, b) => {
        const scoreA = calculateLeadScore(a, leadScoringConfig).score
        const scoreB = calculateLeadScore(b, leadScoringConfig).score
        return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA
      })
    : filteredClientsBase

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const hasNextPage = currentPage < totalPages
  const hasPreviousPage = currentPage > 1
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalCount)

  function goToNextPage() {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1)
    }
  }

  function goToPreviousPage() {
    if (hasPreviousPage) {
      setCurrentPage(currentPage - 1)
    }
  }

  const statusColors: Record<string, string> = {
    lead: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    inactive: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    churned: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }

  // Toggle sort direction or change sort field
  function handleSort(field: SortField) {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new field with default direction
      setSortField(field)
      setSortDirection(field === 'name' ? 'asc' : 'desc')
    }
  }

  // Render sort icon for column header
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 text-slate-400" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1 text-primary-600 dark:text-primary-400" />
      : <ArrowDown className="h-4 w-4 ml-1 text-primary-600 dark:text-primary-400" />
  }

  // Bulk selection functions
  function toggleClientSelection(clientId: string) {
    setSelectedClients(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(filteredClients.map(c => c.id)))
    }
  }

  function clearSelection() {
    setSelectedClients(new Set())
  }

  const isAllSelected = filteredClients.length > 0 && selectedClients.size === filteredClients.length
  const isSomeSelected = selectedClients.size > 0 && selectedClients.size < filteredClients.length

  // Bulk soft delete selected clients (set deleted_at)
  async function handleBulkDelete() {
    if (selectedClients.size === 0) return

    setIsDeleting(true)
    const clientIds = Array.from(selectedClients)

    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', clientIds)

    if (error) {
      console.error('Error deleting clients:', error)
      alert('Failed to delete clients. Please try again.')
    } else {
      setDeleteSuccess(`Successfully deleted ${clientIds.length} client${clientIds.length > 1 ? 's' : ''}. You can restore them from the Deleted view.`)
      setSelectedClients(new Set())
      fetchClients()
      // Clear success message after 4 seconds
      setTimeout(() => setDeleteSuccess(null), 4000)
    }

    setIsDeleting(false)
    setIsDeleteModalOpen(false)
  }

  // Restore selected deleted clients
  async function handleBulkRestore() {
    if (selectedClients.size === 0) return

    setIsDeleting(true) // Reusing the deleting state for loading
    const clientIds = Array.from(selectedClients)

    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: null })
      .in('id', clientIds)

    if (error) {
      console.error('Error restoring clients:', error)
      alert('Failed to restore clients. Please try again.')
    } else {
      setRestoreSuccess(`Successfully restored ${clientIds.length} client${clientIds.length > 1 ? 's' : ''}`)
      setSelectedClients(new Set())
      fetchClients()
      // Clear success message after 3 seconds
      setTimeout(() => setRestoreSuccess(null), 3000)
    }

    setIsDeleting(false)
  }

  // Permanently delete selected deleted clients (hard delete)
  async function handlePermanentDelete() {
    if (selectedClients.size === 0) return

    setIsPermanentlyDeleting(true)
    const clientIds = Array.from(selectedClients)

    const { error } = await supabase
      .from('clients')
      .delete()
      .in('id', clientIds)

    if (error) {
      console.error('Error permanently deleting clients:', error)
      alert('Failed to permanently delete clients. Please try again.')
    } else {
      setPermanentDeleteSuccess(`Permanently deleted ${clientIds.length} client${clientIds.length > 1 ? 's' : ''}`)
      setSelectedClients(new Set())
      fetchClients()
      // Clear success message after 3 seconds
      setTimeout(() => setPermanentDeleteSuccess(null), 3000)
    }

    setIsPermanentlyDeleting(false)
    setIsPermanentDeleteModalOpen(false)
  }

  // Helper function to fetch export data
  async function fetchExportData() {
    if (!currentWorkspace) return null

    // Build query with current filters to get ALL filtered data (not just current page)
    let query = supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)

    // Apply status filter
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    // Apply date filter
    const dateRange = getDateRange(dateFilter)
    if (dateRange) {
      query = query.gte('created_at', dateRange.start).lt('created_at', dateRange.end)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching clients for export:', error)
      return null
    }

    let exportData = data || []

    // Apply client-side search filter
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase()
      exportData = exportData.filter((client) =>
        client.name.toLowerCase().includes(queryLower) ||
        client.company?.toLowerCase().includes(queryLower) ||
        client.email?.toLowerCase().includes(queryLower) ||
        client.source?.toLowerCase().includes(queryLower)
      )
    }

    return exportData
  }

  // Export filtered clients to CSV
  async function exportToCSV() {
    const exportData = await fetchExportData()
    if (!exportData || exportData.length === 0) {
      alert('No clients to export')
      return
    }

    // Collect all unique custom field keys
    const customFieldKeys = new Set<string>()
    exportData.forEach(client => {
      if (client.custom_fields && typeof client.custom_fields === 'object') {
        Object.keys(client.custom_fields as Record<string, unknown>).forEach(key => {
          if (key !== 'tags') customFieldKeys.add(key)
        })
      }
    })
    const customFieldHeaders = Array.from(customFieldKeys).sort()

    // Create CSV content with custom fields
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Status', 'Value', 'Source', 'Website', 'Notes', 'Tags', ...customFieldHeaders, 'Created']
    const rows = exportData.map(client => {
      const customFields = client.custom_fields as Record<string, unknown> | null
      const tags = customFields?.tags
      const tagsString = Array.isArray(tags) ? tags.join('; ') : ''

      return [
        client.name || '',
        client.company || '',
        client.email || '',
        client.phone || '',
        client.status || '',
        client.value?.toString() || '',
        client.source || '',
        client.website || '',
        (client.notes || '').replace(/"/g, '""'), // Escape quotes in notes
        tagsString,
        ...customFieldHeaders.map(key => {
          const value = customFields?.[key]
          if (typeof value === 'string') return value.replace(/"/g, '""')
          if (Array.isArray(value)) return value.join('; ').replace(/"/g, '""')
          return value?.toString() || ''
        }),
        client.created_at ? new Date(client.created_at).toLocaleDateString() : ''
      ]
    })

    // Build CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `clients-export-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await fetchClients()
    await fetchAvailableSources()
  }, [currentWorkspace, currentPage, statusFilter, dateFilter, sourceFilter, sortField, sortDirection, showDeletedClients])

  // Export filtered clients to JSON
  async function exportToJSON() {
    const exportData = await fetchExportData()
    if (!exportData || exportData.length === 0) {
      alert('No clients to export')
      return
    }

    // Format data for JSON export (clean structure)
    const jsonData = exportData.map(client => ({
      name: client.name || '',
      company: client.company || null,
      email: client.email || null,
      phone: client.phone || null,
      status: client.status || '',
      value: client.value || null,
      source: client.source || null,
      website: client.website || null,
      notes: client.notes || null,
      created_at: client.created_at || null
    }))

    // Create JSON content with pretty formatting
    const jsonContent = JSON.stringify(jsonData, null, 2)

    // Create and trigger download
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `clients-export-${new Date().toISOString().split('T')[0]}.json`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-full">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {showDeletedClients ? 'Deleted Clients' : 'Clients'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {showDeletedClients ? 'View and restore deleted clients' : 'Manage your clients and leads'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowDeletedClients(!showDeletedClients)
              setSelectedClients(new Set())
              setCurrentPage(1)
            }}
            className={`btn-outline min-h-[44px] ${showDeletedClients ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400' : ''}`}
          >
            {showDeletedClients ? (
              <>
                <RotateCcw className="h-5 w-5 mr-2" />
                Back to Active
              </>
            ) : (
              <>
                <Archive className="h-5 w-5 mr-2" />
                View Deleted
              </>
            )}
          </button>
          {!showDeletedClients && canEdit && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Client
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 z-10" />
          <input
            type="search"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSearchSuggestions(true)
            }}
            onFocus={() => {
              setShowRecentSearches(true)
              setShowSearchSuggestions(true)
            }}
            onBlur={() => {
              // Delay hiding to allow click on dropdown
              setTimeout(() => {
                setShowRecentSearches(false)
                setShowSearchSuggestions(false)
              }, 200)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                addToRecentSearches(searchQuery)
                setShowSearchSuggestions(false)
              }
            }}
            className="input pl-10"
          />
          {/* Recent Searches Dropdown */}
          {showRecentSearches && recentSearches.length > 0 && !searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-20 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Recent Searches</span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    clearRecentSearches()
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  Clear all
                </button>
              </div>
              <div className="py-1">
                {recentSearches.map((query, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer group"
                    onClick={() => {
                      setSearchQuery(query)
                      setShowRecentSearches(false)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{query}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeRecentSearch(query)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
                      title="Remove from recent searches"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Search Suggestions Dropdown */}
          {showSearchSuggestions && searchQuery && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-20 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Suggestions</span>
              </div>
              <div className="py-1">
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="flex items-center px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    onClick={() => {
                      setSearchQuery(suggestion)
                      addToRecentSearches(suggestion)
                      setShowSearchSuggestions(false)
                    }}
                  >
                    <Search className="h-4 w-4 text-slate-400 mr-2" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {highlightMatch(suggestion, searchQuery)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn-outline min-h-[44px]"
            title="Import clients from CSV"
          >
            <Upload className="h-5 w-5 mr-2" />
            Import
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            className="btn-outline min-h-[44px]"
            title="Export filtered clients"
          >
            <Download className="h-5 w-5 mr-2" />
            Export
          </button>
          {showExportDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
              <div className="py-1">
                <button
                  onClick={() => {
                    exportToCSV()
                    setShowExportDropdown(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => {
                    exportToJSON()
                    setShowExportDropdown(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Export as JSON
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-outline min-h-[44px] ${(statusFilter || dateFilter) ? 'border-primary-500 text-primary-600' : ''}`}
          >
            <Filter className="h-5 w-5 mr-2" />
            Filters
            {(statusFilter || dateFilter || sourceFilter || favoritesFilter) && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 rounded">
                {(statusFilter ? 1 : 0) + (dateFilter ? 1 : 0) + (sourceFilter ? 1 : 0) + (favoritesFilter ? 1 : 0)}
              </span>
            )}
          </button>
          {/* Save Filter Preset Button */}
          {hasActiveFilters && (
            <button
              onClick={() => setShowSavePresetModal(true)}
              className="btn-outline min-h-[44px]"
              title="Save current filters as preset"
            >
              <Save className="h-5 w-5 mr-2" />
              Save Filter
            </button>
          )}
          {/* Load Filter Preset Button */}
          {filterPresets.length > 0 && (
            <button
              onClick={() => setShowLoadPresetModal(true)}
              className="btn-outline min-h-[44px]"
              title="Load saved filter preset"
            >
              <FolderOpen className="h-5 w-5 mr-2" />
              Load Preset
            </button>
          )}
          {showFilters && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white">Filters</h3>
                  {(statusFilter || dateFilter || sourceFilter || favoritesFilter) && (
                    <button
                      onClick={() => {
                        setStatusFilter(null)
                        setDateFilter(null)
                        setSourceFilter(null)
                        setFavoritesFilter(false)
                        setShowFilters(false)
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {/* Favorites Filter */}
                  <div>
                    <button
                      onClick={() => setFavoritesFilter(!favoritesFilter)}
                      className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center ${
                        favoritesFilter
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Star className={`h-4 w-4 mr-2 ${favoritesFilter ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                      Favorites Only
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">Status</label>
                    <div className="space-y-1">
                      {(['lead', 'active', 'inactive', 'churned'] as ClientStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            setStatusFilter(statusFilter === status ? null : status)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm rounded-lg capitalize transition-colors ${
                            statusFilter === status
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            status === 'lead' ? 'bg-yellow-500' :
                            status === 'active' ? 'bg-green-500' :
                            status === 'inactive' ? 'bg-slate-400' : 'bg-red-500'
                          }`} />
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">Created</label>
                    <div className="space-y-1">
                      {([
                        { value: 'today', label: 'Today' },
                        { value: 'this_week', label: 'This Week' },
                        { value: 'this_month', label: 'This Month' },
                      ] as { value: DateFilter; label: string }[]).map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setDateFilter(dateFilter === option.value ? null : option.value)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${
                            dateFilter === option.value
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {availableSources.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">Source</label>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {availableSources.map((source) => (
                          <button
                            key={source}
                            onClick={() => {
                              setSourceFilter(sourceFilter === source ? null : source)
                            }}
                            className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${
                              sourceFilter === source
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {source}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {(statusFilter || dateFilter || sourceFilter || favoritesFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 dark:text-slate-400">Filtered by:</span>
          {favoritesFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-sm">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              Favorites
              <button
                onClick={() => setFavoritesFilter(false)}
                className="hover:text-yellow-900 dark:hover:text-yellow-100"
                aria-label="Clear favorites filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {statusFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm capitalize">
              {statusFilter}
              <button
                onClick={() => setStatusFilter(null)}
                className="hover:text-primary-900 dark:hover:text-primary-100"
                aria-label="Clear status filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {dateFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm">
              {dateFilter === 'today' ? 'Created Today' : dateFilter === 'this_week' ? 'Created This Week' : 'Created This Month'}
              <button
                onClick={() => setDateFilter(null)}
                className="hover:text-primary-900 dark:hover:text-primary-100"
                aria-label="Clear date filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {sourceFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm">
              Source: {sourceFilter}
              <button
                onClick={() => setSourceFilter(null)}
                className="hover:text-primary-900 dark:hover:text-primary-100"
                aria-label="Clear source filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Success Message */}
      {deleteSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            {deleteSuccess}
          </span>
        </div>
      )}

      {/* Restore Success Message */}
      {restoreSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            {restoreSuccess}
          </span>
        </div>
      )}

      {/* Permanent Delete Success Message */}
      {permanentDeleteSuccess && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            {permanentDeleteSuccess}
          </span>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedClients.size > 0 && (
        <div className={`${showDeletedClients ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'} border rounded-lg p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <CheckSquare className={`h-5 w-5 ${showDeletedClients ? 'text-amber-600 dark:text-amber-400' : 'text-primary-600 dark:text-primary-400'}`} />
            <span className={`text-sm font-medium ${showDeletedClients ? 'text-amber-700 dark:text-amber-300' : 'text-primary-700 dark:text-primary-300'}`}>
              {selectedClients.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="btn-outline text-sm py-1.5"
            >
              Clear selection
            </button>
            {canEdit && (
              showDeletedClients ? (
                <>
                  <button
                    onClick={handleBulkRestore}
                    disabled={isDeleting || isPermanentlyDeleting}
                    className="btn-outline text-sm py-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200 dark:border-green-800"
                  >
                    {isDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-1.5"></div>
                        Restoring...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-1.5" />
                        Restore selected
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsPermanentDeleteModalOpen(true)}
                    disabled={isDeleting || isPermanentlyDeleting}
                    className="btn-outline text-sm py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Permanent Delete
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="btn-outline text-sm py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete selected
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Client List */}
      {loading ? (
        <ClientTableSkeleton rows={5} />
      ) : filteredClients.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            {searchQuery.trim() ? 'No clients found' : 'No clients yet'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
            {searchQuery.trim()
              ? 'Try a different search term.'
              : 'Get started by adding your first client to track leads and manage relationships.'}
          </p>
          {!searchQuery.trim() && canEdit && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Your First Client
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 w-12">
                  <button
                    onClick={toggleSelectAll}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isAllSelected
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : isSomeSelected
                        ? 'bg-primary-200 border-primary-400 dark:bg-primary-800 dark:border-primary-600'
                        : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500'
                    }`}
                    aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
                  >
                    {(isAllSelected || isSomeSelected) && (
                      <CheckSquare className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    Client
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    Status
                    <SortIcon field="status" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('value')}
                    className="flex items-center hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    Value
                    <SortIcon field="value" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('score')}
                    className="flex items-center hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    Score
                    <SortIcon field="score" />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('created_at')}
                    className="flex items-center hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    Created
                    <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    selectedClients.has(client.id) ? 'bg-primary-50 dark:bg-primary-900/10' : ''
                  }`}
                >
                  <td className="px-4 py-4 w-12">
                    <button
                      onClick={() => toggleClientSelection(client.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedClients.has(client.id)
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500'
                      }`}
                      aria-label={selectedClients.has(client.id) ? 'Deselect client' : 'Select client'}
                    >
                      {selectedClients.has(client.id) && (
                        <CheckSquare className="h-3 w-3" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start">
                      <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium flex-shrink-0">
                        {client.name[0].toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <Link
                          to={`/clients/${client.id}`}
                          state={{ from: `/clients${searchParams.toString() ? `?${searchParams.toString()}` : ''}` }}
                          className="text-sm font-medium text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center min-h-[44px] -my-3"
                        >
                          {favoriteClientIds.has(client.id) && (
                            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500 mr-1.5 flex-shrink-0" />
                          )}
                          {searchQuery ? highlightMatch(client.name, searchQuery) : client.name}
                        </Link>
                        {client.company && (
                          <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center mt-0.5">
                            <Building2 className="h-3 w-3 mr-1" />
                            {searchQuery ? highlightMatch(client.company, searchQuery) : client.company}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {client.email && (
                            <span className="text-xs text-slate-400 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {searchQuery ? highlightMatch(client.email, searchQuery) : client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="text-xs text-slate-400 flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {searchQuery ? highlightMatch(client.phone, searchQuery) : client.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[client.status]}`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                    {client.value ? `$${client.value.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(() => {
                      const settings = currentWorkspace?.settings as { leadScoring?: LeadScoringConfig } | null
                      const config = settings?.leadScoring
                      if (!config?.enabled) return <span className="text-slate-400">-</span>
                      const score = calculateLeadScore(client, config)
                      if (score.maxScore === 0) return <span className="text-slate-400">-</span>
                      return (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getScoreColor(score.percentage)}`}>
                          {score.score} · {getScoreLabel(score.percentage)}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {client.source || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {client.created_at ? new Date(client.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => toggleFavorite(client.id, e)}
                        className={`icon-btn ${favoriteClientIds.has(client.id) ? 'text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`}
                        aria-label={favoriteClientIds.has(client.id) ? 'Remove from favorites' : 'Add to favorites'}
                        title={favoriteClientIds.has(client.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star className={`h-5 w-5 ${favoriteClientIds.has(client.id) ? 'fill-yellow-500' : ''}`} />
                      </button>
                      <button className="icon-btn" aria-label="Client actions">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalCount > ITEMS_PER_PAGE && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Showing <span className="font-medium">{startItem}</span> to{' '}
                <span className="font-medium">{endItem}</span> of{' '}
                <span className="font-medium">{totalCount}</span> clients
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousPage}
                  disabled={!hasPreviousPage}
                  className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-300 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={!hasNextPage}
                  className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Client Stats - Report showing client count by status */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Clients</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{clients.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Leads</p>
            <p className="text-2xl font-bold text-yellow-600">{clients.filter(c => c.status === 'lead').length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Active</p>
            <p className="text-2xl font-bold text-green-600">{clients.filter(c => c.status === 'active').length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Inactive</p>
            <p className="text-2xl font-bold text-slate-500 dark:text-slate-400">{clients.filter(c => c.status === 'inactive').length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Churned</p>
            <p className="text-2xl font-bold text-red-600">{clients.filter(c => c.status === 'churned').length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Value</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              ${clients.reduce((sum, c) => sum + (c.value || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onClientAdded={fetchClients}
      />

      {/* Import Clients Modal */}
      <ImportClientsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={fetchClients}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
            />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Delete {selectedClients.size} client{selectedClients.size > 1 ? 's' : ''}?
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                Are you sure you want to permanently delete the selected client{selectedClients.size > 1 ? 's' : ''}?
                All associated data including projects and tasks will also be removed.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {isPermanentDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => !isPermanentlyDeleting && setIsPermanentDeleteModalOpen(false)}
            />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Permanently delete {selectedClients.size} client{selectedClients.size > 1 ? 's' : ''}?
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    This action is irreversible
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                Are you sure you want to <strong className="text-red-600 dark:text-red-400">permanently delete</strong> the selected client{selectedClients.size > 1 ? 's' : ''}?
                This will remove all associated data and <strong>cannot be undone</strong>. The client{selectedClients.size > 1 ? 's' : ''} will not be recoverable.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsPermanentDeleteModalOpen(false)}
                  disabled={isPermanentlyDeleting}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePermanentDelete}
                  disabled={isPermanentlyDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {isPermanentlyDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting forever...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Permanently
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Filter Preset Modal */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => {
                setShowSavePresetModal(false)
                setNewPresetName('')
                setPresetError('')
              }}
            />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <Save className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Save Filter Preset
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Save current filters for quick access
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Preset Name
                  </label>
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => {
                      setNewPresetName(e.target.value)
                      setPresetError('')
                    }}
                    placeholder="e.g., Active High Value"
                    className="input w-full"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveFilterPreset()
                      }
                    }}
                  />
                  {presetError && (
                    <p className="text-sm text-red-500 mt-1">{presetError}</p>
                  )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Filters to save:</p>
                  <div className="flex flex-wrap gap-2">
                    {statusFilter && (
                      <span className="inline-flex items-center px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs capitalize">
                        Status: {statusFilter}
                      </span>
                    )}
                    {dateFilter && (
                      <span className="inline-flex items-center px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                        {dateFilter === 'today' ? 'Created Today' : dateFilter === 'this_week' ? 'This Week' : 'This Month'}
                      </span>
                    )}
                    {sourceFilter && (
                      <span className="inline-flex items-center px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                        Source: {sourceFilter}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowSavePresetModal(false)
                    setNewPresetName('')
                    setPresetError('')
                  }}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFilterPreset}
                  className="btn-primary"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Load Filter Preset Modal */}
      {showLoadPresetModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowLoadPresetModal(false)}
            />
            <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Load Filter Preset
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Select a saved preset to apply
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filterPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                  >
                    <button
                      onClick={() => loadFilterPreset(preset)}
                      className="flex-1 text-left"
                    >
                      <p className="font-medium text-slate-900 dark:text-white">
                        {preset.name}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {preset.statusFilter && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                            {preset.statusFilter}
                          </span>
                        )}
                        {preset.statusFilter && (preset.dateFilter || preset.sourceFilter) && (
                          <span className="text-xs text-slate-400">•</span>
                        )}
                        {preset.dateFilter && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {preset.dateFilter === 'today' ? 'Today' : preset.dateFilter === 'this_week' ? 'This Week' : 'This Month'}
                          </span>
                        )}
                        {preset.dateFilter && preset.sourceFilter && (
                          <span className="text-xs text-slate-400">•</span>
                        )}
                        {preset.sourceFilter && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {preset.sourceFilter}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteFilterPreset(preset.id)}
                      className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete preset"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowLoadPresetModal(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </PullToRefresh>
  )
}

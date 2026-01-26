import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, MoreHorizontal, Building2, Mail, Phone, ChevronLeft, ChevronRight, X, Download, Upload, Trash2, CheckSquare, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { AddClientModal } from '../../components/clients/AddClientModal'
import { ImportClientsModal } from '../../components/clients/ImportClientsModal'
import { ClientTableSkeleton } from '../../components/ui/Skeleton'
import type { Client, ClientStatus } from '../../types/database'

const ITEMS_PER_PAGE = 20

type DateFilter = 'today' | 'this_week' | 'this_month' | null

export function ClientsPage() {
  const { currentWorkspace } = useWorkspace()
  const [searchQuery, setSearchQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<ClientStatus | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)

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
    }
  }, [currentWorkspace, currentPage, statusFilter, dateFilter])

  // Reset to page 1 when search query or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, dateFilter])

  async function fetchClients() {
    if (!currentWorkspace) return

    setLoading(true)

    // Build the base query for count
    let countQuery = supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', currentWorkspace.id)

    // Apply status filter to count query
    if (statusFilter) {
      countQuery = countQuery.eq('status', statusFilter)
    }

    // Apply date filter to count query
    const dateRange = getDateRange(dateFilter)
    if (dateRange) {
      countQuery = countQuery.gte('created_at', dateRange.start).lt('created_at', dateRange.end)
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

    // Apply status filter to data query
    if (statusFilter) {
      dataQuery = dataQuery.eq('status', statusFilter)
    }

    // Apply date filter to data query
    if (dateRange) {
      dataQuery = dataQuery.gte('created_at', dateRange.start).lt('created_at', dateRange.end)
    }

    const { data, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error fetching clients:', error)
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }

  const filteredClients = clients.filter((client) => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true // Show all clients when search is empty or only spaces
    return (
      client.name.toLowerCase().includes(query) ||
      client.company?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.source?.toLowerCase().includes(query)
    )
  })

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

  // Bulk delete selected clients
  async function handleBulkDelete() {
    if (selectedClients.size === 0) return

    setIsDeleting(true)
    const clientIds = Array.from(selectedClients)

    const { error } = await supabase
      .from('clients')
      .delete()
      .in('id', clientIds)

    if (error) {
      console.error('Error deleting clients:', error)
      alert('Failed to delete clients. Please try again.')
    } else {
      setDeleteSuccess(`Successfully deleted ${clientIds.length} client${clientIds.length > 1 ? 's' : ''}`)
      setSelectedClients(new Set())
      fetchClients()
      // Clear success message after 3 seconds
      setTimeout(() => setDeleteSuccess(null), 3000)
    }

    setIsDeleting(false)
    setIsDeleteModalOpen(false)
  }

  // Export filtered clients to CSV
  async function exportToCSV() {
    if (!currentWorkspace) return

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
      return
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

    if (exportData.length === 0) {
      alert('No clients to export')
      return
    }

    // Create CSV content
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Status', 'Value', 'Source', 'Website', 'Notes', 'Created']
    const rows = exportData.map(client => [
      client.name || '',
      client.company || '',
      client.email || '',
      client.phone || '',
      client.status || '',
      client.value?.toString() || '',
      client.source || '',
      client.website || '',
      (client.notes || '').replace(/"/g, '""'), // Escape quotes in notes
      client.created_at ? new Date(client.created_at).toLocaleDateString() : ''
    ])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Clients
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage your clients and leads
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Client
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="search"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="btn-outline min-h-[44px]"
          title="Import clients from CSV"
        >
          <Upload className="h-5 w-5 mr-2" />
          Import
        </button>
        <button
          onClick={exportToCSV}
          className="btn-outline min-h-[44px]"
          title="Export filtered clients to CSV"
        >
          <Download className="h-5 w-5 mr-2" />
          Export
        </button>
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-outline min-h-[44px] ${(statusFilter || dateFilter) ? 'border-primary-500 text-primary-600' : ''}`}
          >
            <Filter className="h-5 w-5 mr-2" />
            Filters
            {(statusFilter || dateFilter) && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 rounded">
                {(statusFilter ? 1 : 0) + (dateFilter ? 1 : 0)}
              </span>
            )}
          </button>
          {showFilters && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white">Filters</h3>
                  {(statusFilter || dateFilter) && (
                    <button
                      onClick={() => {
                        setStatusFilter(null)
                        setDateFilter(null)
                        setShowFilters(false)
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-4">
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
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {(statusFilter || dateFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 dark:text-slate-400">Filtered by:</span>
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

      {/* Bulk Action Bar */}
      {selectedClients.size > 0 && (
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
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
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="btn-outline text-sm py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete selected
            </button>
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
          {!searchQuery.trim() && (
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
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Source
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
                          className="text-sm font-medium text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center min-h-[44px] -my-3"
                        >
                          {client.name}
                        </Link>
                        {client.company && (
                          <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center mt-0.5">
                            <Building2 className="h-3 w-3 mr-1" />
                            {client.company}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {client.email && (
                            <span className="text-xs text-slate-400 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="text-xs text-slate-400 flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {client.phone}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {client.source || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="icon-btn" aria-label="Client actions">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
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

      {/* Client Stats */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
    </div>
  )
}

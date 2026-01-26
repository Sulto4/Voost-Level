import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, MoreHorizontal, Building2, Mail, Phone, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useWorkspace } from '../../context/WorkspaceContext'
import { AddClientModal } from '../../components/clients/AddClientModal'
import { ClientTableSkeleton } from '../../components/ui/Skeleton'
import type { Client, ClientStatus } from '../../types/database'

const ITEMS_PER_PAGE = 20

export function ClientsPage() {
  const { currentWorkspace } = useWorkspace()
  const [searchQuery, setSearchQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<ClientStatus | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (currentWorkspace) {
      fetchClients()
    }
  }, [currentWorkspace, currentPage, statusFilter])

  // Reset to page 1 when search query or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

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
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-outline min-h-[44px] ${statusFilter ? 'border-primary-500 text-primary-600' : ''}`}
          >
            <Filter className="h-5 w-5 mr-2" />
            Filters
            {statusFilter && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 rounded">1</span>
            )}
          </button>
          {showFilters && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white">Filters</h3>
                  {statusFilter && (
                    <button
                      onClick={() => {
                        setStatusFilter(null)
                        setShowFilters(false)
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">Status</label>
                  <div className="space-y-1">
                    {(['lead', 'active', 'inactive', 'churned'] as ClientStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(statusFilter === status ? null : status)
                          setShowFilters(false)
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Filtered by:</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm capitalize">
            {statusFilter}
            <button
              onClick={() => setStatusFilter(null)}
              className="hover:text-primary-900 dark:hover:text-primary-100"
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
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
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
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
    </div>
  )
}

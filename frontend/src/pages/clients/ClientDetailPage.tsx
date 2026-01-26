import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Mail, Phone, Globe, Building } from 'lucide-react'
import { clsx } from 'clsx'

const tabs = ['Overview', 'Projects', 'Activity', 'Files']

export function ClientDetailPage() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('Overview')

  // This would come from API
  const client = null

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/clients"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Client Name
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Company Name</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="btn-outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
          <button className="btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
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
                  Contact Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center text-slate-600 dark:text-slate-300">
                    <Mail className="h-5 w-5 mr-3 text-slate-400" />
                    <span>email@example.com</span>
                  </div>
                  <div className="flex items-center text-slate-600 dark:text-slate-300">
                    <Phone className="h-5 w-5 mr-3 text-slate-400" />
                    <span>+1 234 567 8900</span>
                  </div>
                  <div className="flex items-center text-slate-600 dark:text-slate-300">
                    <Globe className="h-5 w-5 mr-3 text-slate-400" />
                    <span>www.example.com</span>
                  </div>
                  <div className="flex items-center text-slate-600 dark:text-slate-300">
                    <Building className="h-5 w-5 mr-3 text-slate-400" />
                    <span>Company Name</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Details
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Status</dt>
                    <dd className="mt-1">
                      <span className="badge-primary">Lead</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Source</dt>
                    <dd className="text-slate-900 dark:text-white">Referral</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Deal Value</dt>
                    <dd className="text-slate-900 dark:text-white">$10,000</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'Projects' && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p>No projects yet</p>
            <button className="btn-primary mt-4">Add Project</button>
          </div>
        )}
        {activeTab === 'Activity' && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p>No activity yet</p>
            <button className="btn-primary mt-4">Add Note</button>
          </div>
        )}
        {activeTab === 'Files' && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p>No files yet</p>
            <button className="btn-primary mt-4">Upload File</button>
          </div>
        )}
      </div>
    </div>
  )
}

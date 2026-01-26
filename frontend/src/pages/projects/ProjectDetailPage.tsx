import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Plus, CheckSquare } from 'lucide-react'
import { clsx } from 'clsx'

const tabs = ['Overview', 'Tasks', 'Files']

export function ProjectDetailPage() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('Overview')

  // This would come from API
  const project = null

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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/projects"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Project Name
            </h1>
            <p className="text-slate-500 dark:text-slate-400">Client Name</p>
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
                  Project Details
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Status</dt>
                    <dd className="mt-1">
                      <span className="badge-primary">Planning</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Start Date</dt>
                    <dd className="text-slate-900 dark:text-white">-</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Due Date</dt>
                    <dd className="text-slate-900 dark:text-white">-</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Budget</dt>
                    <dd className="text-slate-900 dark:text-white">$0</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Description
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  No description provided.
                </p>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'Tasks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Tasks
              </h3>
              <button className="btn-primary text-sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Task
              </button>
            </div>
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tasks yet</p>
              <p className="text-sm">Create tasks to track project progress</p>
            </div>
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

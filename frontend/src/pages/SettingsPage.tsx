import { useState, useEffect } from 'react'
import { User, Building2, Palette, Bell, Shield } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useWorkspace } from '../context/WorkspaceContext'

const tabs = [
  { name: 'Profile', icon: User },
  { name: 'Workspace', icon: Building2 },
  { name: 'Appearance', icon: Palette },
  { name: 'Notifications', icon: Bell },
  { name: 'Security', icon: Shield },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('Profile')
  const { profile, updateProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const { currentWorkspace, currentRole, updateWorkspace } = useWorkspace()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)

  // Workspace settings state
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || '')
  const [workspaceSlug, setWorkspaceSlug] = useState(currentWorkspace?.slug || '')
  const [workspaceSaving, setWorkspaceSaving] = useState(false)
  const [workspaceSuccess, setWorkspaceSuccess] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')

  // Update workspace form when currentWorkspace changes
  useEffect(() => {
    if (currentWorkspace) {
      setWorkspaceName(currentWorkspace.name)
      setWorkspaceSlug(currentWorkspace.slug)
    }
  }, [currentWorkspace])

  async function handleProfileSave() {
    setSaving(true)
    await updateProfile({ full_name: fullName })
    setSaving(false)
  }

  async function handleWorkspaceSave() {
    if (!currentWorkspace) return

    setWorkspaceSaving(true)
    setWorkspaceError('')
    setWorkspaceSuccess(false)

    const { error } = await updateWorkspace(currentWorkspace.id, {
      name: workspaceName.trim(),
      slug: workspaceSlug.trim(),
    })

    if (error) {
      setWorkspaceError(error.message || 'Failed to update workspace')
    } else {
      setWorkspaceSuccess(true)
      setTimeout(() => setWorkspaceSuccess(false), 3000)
    }

    setWorkspaceSaving(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Manage your account and workspace settings
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={clsx(
                  'w-full flex items-center px-3 py-2.5 min-h-[44px] text-sm font-medium rounded-lg transition-colors',
                  activeTab === tab.name
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <tab.icon className="h-5 w-5 mr-3" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 card p-6">
          {activeTab === 'Profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Profile Settings
              </h2>

              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold">
                  {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <button className="btn-outline min-h-[44px]">Change Avatar</button>
              </div>

              <div className="max-w-md space-y-4">
                <div>
                  <label htmlFor="fullName" className="label">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={profile?.email || ''}
                    className="input bg-slate-50 dark:bg-slate-700"
                    disabled
                  />
                  <p className="text-sm text-slate-500 mt-1">Email cannot be changed</p>
                </div>
                <button
                  onClick={handleProfileSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Workspace' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Workspace Settings
              </h2>

              {currentRole !== 'owner' && currentRole !== 'admin' ? (
                <p className="text-slate-500 dark:text-slate-400">
                  You don't have permission to edit workspace settings.
                </p>
              ) : (
                <div className="max-w-md space-y-4">
                  {workspaceError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
                      {workspaceError}
                    </div>
                  )}
                  {workspaceSuccess && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                      Workspace settings saved successfully!
                    </div>
                  )}
                  <div>
                    <label htmlFor="workspaceName" className="label">Workspace Name</label>
                    <input
                      id="workspaceName"
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="workspaceSlug" className="label">Workspace Slug</label>
                    <input
                      id="workspaceSlug"
                      type="text"
                      value={workspaceSlug}
                      onChange={(e) => setWorkspaceSlug(e.target.value)}
                      className="input"
                    />
                  </div>
                  <button
                    onClick={handleWorkspaceSave}
                    disabled={workspaceSaving}
                    className="btn-primary"
                  >
                    {workspaceSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Appearance' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Appearance
              </h2>

              <div>
                <label className="label">Theme</label>
                <div className="flex gap-4 mt-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={clsx(
                      'flex flex-col items-center p-4 rounded-lg border-2 transition-colors',
                      theme === 'light'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    <div className="w-16 h-12 rounded bg-white border border-slate-200 mb-2" />
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={clsx(
                      'flex flex-col items-center p-4 rounded-lg border-2 transition-colors',
                      theme === 'dark'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    <div className="w-16 h-12 rounded bg-slate-800 border border-slate-600 mb-2" />
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Notification Preferences
              </h2>

              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-900 dark:text-white font-medium">Email Notifications</span>
                    <p className="text-sm text-slate-500">Receive email updates about your account</p>
                  </div>
                  <input type="checkbox" className="h-5 w-5 rounded text-primary-600" defaultChecked />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-900 dark:text-white font-medium">In-App Notifications</span>
                    <p className="text-sm text-slate-500">Show notifications within the application</p>
                  </div>
                  <input type="checkbox" className="h-5 w-5 rounded text-primary-600" defaultChecked />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Security Settings
              </h2>

              <div className="max-w-md">
                <h3 className="font-medium text-slate-900 dark:text-white mb-2">Change Password</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Update your password to keep your account secure.
                </p>
                <button className="btn-outline">Change Password</button>
              </div>

              <hr className="border-slate-200 dark:border-slate-700" />

              <div className="max-w-md">
                <h3 className="font-medium text-slate-900 dark:text-white mb-2">Active Sessions</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Manage your active sessions and log out from other devices.
                </p>
                <button className="btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Log Out All Sessions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

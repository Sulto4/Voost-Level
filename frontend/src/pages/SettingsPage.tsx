import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Building2, Palette, Bell, Shield, Webhook, Plus, Trash2, Check, X, AlertTriangle, UserCog, ClipboardList, Phone, Mail, Calendar, FileText, RefreshCw, Upload, Camera } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import type { Webhook as WebhookType, WorkspaceMember, Activity } from '../types/database'

const tabs = [
  { name: 'Profile', icon: User },
  { name: 'Workspace', icon: Building2 },
  { name: 'Appearance', icon: Palette },
  { name: 'Notifications', icon: Bell },
  { name: 'Integrations', icon: Webhook },
  { name: 'Security', icon: Shield },
  { name: 'Audit Log', icon: ClipboardList },
]

const webhookEvents = [
  { value: 'client.created', label: 'Client Created' },
  { value: 'client.updated', label: 'Client Updated' },
  { value: 'client.deleted', label: 'Client Deleted' },
  { value: 'client.status_changed', label: 'Client Status Changed' },
  { value: 'project.created', label: 'Project Created' },
  { value: 'project.updated', label: 'Project Updated' },
  { value: 'project.completed', label: 'Project Completed' },
  { value: 'activity.created', label: 'Activity Logged' },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Profile')
  const { profile, updateProfile, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { currentWorkspace, currentRole, updateWorkspace, deleteWorkspace, refreshWorkspaces } = useWorkspace()
  const { success: showSuccess, error: showError } = useToast()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Workspace logo upload state
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  // Workspace settings state
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || '')
  const [workspaceSlug, setWorkspaceSlug] = useState(currentWorkspace?.slug || '')
  const [workspaceSaving, setWorkspaceSaving] = useState(false)
  const [workspaceSuccess, setWorkspaceSuccess] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')

  // Webhook state
  const [webhooks, setWebhooks] = useState<WebhookType[]>([])
  const [webhooksLoading, setWebhooksLoading] = useState(false)
  const [showAddWebhook, setShowAddWebhook] = useState(false)
  const [newWebhookName, setNewWebhookName] = useState('')
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [newWebhookSecret, setNewWebhookSecret] = useState('')
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([])
  const [webhookSaving, setWebhookSaving] = useState(false)

  // Danger zone state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [workspaceMembers, setWorkspaceMembers] = useState<(WorkspaceMember & { email?: string; full_name?: string })[]>([])
  const [selectedNewOwner, setSelectedNewOwner] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<(Activity & { user_name?: string; client_name?: string })[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)

  // Update workspace form when currentWorkspace changes
  useEffect(() => {
    if (currentWorkspace) {
      setWorkspaceName(currentWorkspace.name)
      setWorkspaceSlug(currentWorkspace.slug)
    }
  }, [currentWorkspace])

  // Fetch webhooks when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      fetchWebhooks()
    }
  }, [currentWorkspace])

  // Fetch audit logs when tab changes to Audit Log
  useEffect(() => {
    if (activeTab === 'Audit Log' && currentWorkspace) {
      fetchAuditLogs()
    }
  }, [activeTab, currentWorkspace])

  async function fetchWebhooks() {
    if (!currentWorkspace) return
    setWebhooksLoading(true)
    const { data } = await supabase
      .from('webhooks')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false })
    setWebhooks(data || [])
    setWebhooksLoading(false)
  }

  async function fetchAuditLogs() {
    if (!currentWorkspace) return
    setAuditLogsLoading(true)

    // First get all clients for this workspace
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('workspace_id', currentWorkspace.id)

    const clientIds = clients?.map(c => c.id) || []
    const clientMap = new Map(clients?.map(c => [c.id, c.name]) || [])

    if (clientIds.length === 0) {
      setAuditLogs([])
      setAuditLogsLoading(false)
      return
    }

    // Fetch activities for these clients with user info
    const { data: activities } = await supabase
      .from('activities')
      .select(`
        *,
        user:profiles!activities_user_id_fkey(full_name, email)
      `)
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })
      .limit(100)

    const logsWithNames = (activities || []).map(activity => ({
      ...activity,
      user_name: (activity.user as { full_name?: string; email?: string })?.full_name ||
                 (activity.user as { full_name?: string; email?: string })?.email || 'Unknown',
      client_name: clientMap.get(activity.client_id) || 'Unknown Client'
    }))

    setAuditLogs(logsWithNames)
    setAuditLogsLoading(false)
  }

  async function handleAddWebhook() {
    if (!currentWorkspace || !newWebhookName || !newWebhookUrl || newWebhookEvents.length === 0) return
    setWebhookSaving(true)
    const { error } = await supabase.from('webhooks').insert({
      workspace_id: currentWorkspace.id,
      name: newWebhookName,
      url: newWebhookUrl,
      secret: newWebhookSecret || null,
      events: newWebhookEvents,
      is_active: true,
    })
    if (!error) {
      setNewWebhookName('')
      setNewWebhookUrl('')
      setNewWebhookSecret('')
      setNewWebhookEvents([])
      setShowAddWebhook(false)
      fetchWebhooks()
    }
    setWebhookSaving(false)
  }

  async function handleDeleteWebhook(id: string) {
    const { error } = await supabase.from('webhooks').delete().eq('id', id)
    if (!error) {
      fetchWebhooks()
    }
  }

  async function handleToggleWebhook(id: string, isActive: boolean) {
    const { error } = await supabase.from('webhooks').update({ is_active: !isActive }).eq('id', id)
    if (!error) {
      fetchWebhooks()
    }
  }

  function toggleWebhookEvent(event: string) {
    setNewWebhookEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  async function fetchWorkspaceMembers() {
    if (!currentWorkspace || !user) return
    const { data } = await supabase
      .from('workspace_members')
      .select(`
        *,
        user:users!workspace_members_user_id_fkey(email, full_name)
      `)
      .eq('workspace_id', currentWorkspace.id)
      .neq('user_id', user.id) // Exclude current user

    if (data) {
      setWorkspaceMembers(data.map(m => ({
        ...m,
        email: (m.user as { email?: string })?.email,
        full_name: (m.user as { full_name?: string })?.full_name,
      })))
    }
  }

  async function handleDeleteWorkspace() {
    if (!currentWorkspace || deleteConfirmText !== currentWorkspace.name) return

    setDeleting(true)
    setDeleteError('')

    const { error } = await deleteWorkspace(currentWorkspace.id)

    if (error) {
      setDeleteError(error.message || 'Failed to delete workspace')
      setDeleting(false)
    } else {
      // Workspace deleted, redirect to onboarding if no workspaces left
      setShowDeleteModal(false)
      await refreshWorkspaces()
      navigate('/onboarding')
    }
  }

  async function handleTransferOwnership() {
    if (!currentWorkspace || !selectedNewOwner || !user) return

    setTransferring(true)
    setTransferError('')

    // Update new owner's role to owner
    const { error: updateNewError } = await supabase
      .from('workspace_members')
      .update({ role: 'owner' })
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', selectedNewOwner)

    if (updateNewError) {
      setTransferError(updateNewError.message || 'Failed to transfer ownership')
      setTransferring(false)
      return
    }

    // Update current user's role to admin
    const { error: updateCurrentError } = await supabase
      .from('workspace_members')
      .update({ role: 'admin' })
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)

    if (updateCurrentError) {
      setTransferError(updateCurrentError.message || 'Failed to update your role')
      setTransferring(false)
      return
    }

    // Update workspace created_by
    await supabase
      .from('workspaces')
      .update({ created_by: selectedNewOwner })
      .eq('id', currentWorkspace.id)

    setShowTransferModal(false)
    setSelectedNewOwner('')
    setTransferring(false)
    await refreshWorkspaces()
  }

  async function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      showError('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('Image must be less than 5MB')
      return
    }

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage
    setAvatarUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/avatar.${fileExt}`

      // Delete old avatar if exists
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.gif`, `${user.id}/avatar.webp`])

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Add cache-busting timestamp
      const avatarUrl = `${publicUrl}?t=${Date.now()}`

      // Update profile with new avatar URL
      const { error: updateError } = await updateProfile({ avatar_url: avatarUrl })
      if (updateError) {
        throw updateError
      }

      showSuccess('Avatar updated successfully')
    } catch (err) {
      console.error('Avatar upload error:', err)
      showError('Failed to upload avatar')
      setAvatarPreview(null)
    } finally {
      setAvatarUploading(false)
      // Clear the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleProfileSave() {
    setSaving(true)
    const { error } = await updateProfile({ full_name: fullName })
    if (error) {
      showError('Failed to update profile')
    } else {
      showSuccess('Profile updated successfully')
    }
    setSaving(false)
  }

  async function handleLogoClick() {
    logoInputRef.current?.click()
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !currentWorkspace) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      showError('Please select a valid image file (JPEG, PNG, GIF, WebP, or SVG)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('Image must be less than 5MB')
      return
    }

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage
    setLogoUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentWorkspace.id}/logo.${fileExt}`

      // Delete old logos if exist
      await supabase.storage.from('workspace-logos').remove([
        `${currentWorkspace.id}/logo.jpg`,
        `${currentWorkspace.id}/logo.png`,
        `${currentWorkspace.id}/logo.gif`,
        `${currentWorkspace.id}/logo.webp`,
        `${currentWorkspace.id}/logo.svg`
      ])

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('workspace-logos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('workspace-logos')
        .getPublicUrl(fileName)

      // Add cache-busting timestamp
      const logoUrl = `${publicUrl}?t=${Date.now()}`

      // Update workspace with new logo URL
      const { error: updateError } = await updateWorkspace(currentWorkspace.id, { logo_url: logoUrl })
      if (updateError) {
        throw updateError
      }

      showSuccess('Workspace logo updated successfully')
    } catch (err) {
      console.error('Logo upload error:', err)
      showError('Failed to upload logo')
      setLogoPreview(null)
    } finally {
      setLogoUploading(false)
      // Clear the input so the same file can be selected again
      if (logoInputRef.current) {
        logoInputRef.current.value = ''
      }
    }
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
      showError('Failed to update workspace')
    } else {
      setWorkspaceSuccess(true)
      showSuccess('Workspace updated successfully')
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

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
                aria-label="Upload avatar"
              />

              <div className="flex items-center space-x-4">
                <div className="relative group">
                  {(avatarPreview || profile?.avatar_url) ? (
                    <img
                      src={avatarPreview || profile?.avatar_url || ''}
                      alt="Profile avatar"
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold">
                      {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  {/* Overlay with camera icon on hover */}
                  <button
                    onClick={handleAvatarClick}
                    disabled={avatarUploading}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Change avatar"
                  >
                    {avatarUploading ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleAvatarClick}
                    disabled={avatarUploading}
                    className="btn-outline min-h-[44px]"
                  >
                    {avatarUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent mr-2" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Change Avatar
                      </>
                    )}
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    JPEG, PNG, GIF or WebP. Max 5MB.
                  </p>
                </div>
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
                <div className="max-w-md space-y-6">
                  {workspaceError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
                      {workspaceError}
                    </div>
                  )}
                  {workspaceSuccess && (
                    <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm">
                      Workspace settings saved successfully!
                    </div>
                  )}

                  {/* Workspace Logo Upload */}
                  <div>
                    <label className="label">Workspace Logo</label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      onChange={handleLogoChange}
                      className="hidden"
                      aria-label="Upload workspace logo"
                    />
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="relative group">
                        {(logoPreview || currentWorkspace?.logo_url) ? (
                          <img
                            src={logoPreview || currentWorkspace?.logo_url || ''}
                            alt="Workspace logo"
                            className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                            <Building2 className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                        {/* Overlay with camera icon on hover */}
                        <button
                          onClick={handleLogoClick}
                          disabled={logoUploading}
                          className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          aria-label="Change workspace logo"
                        >
                          {logoUploading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                          ) : (
                            <Camera className="h-5 w-5 text-white" />
                          )}
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleLogoClick}
                          disabled={logoUploading}
                          className="btn-outline min-h-[44px]"
                        >
                          {logoUploading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent mr-2" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              {currentWorkspace?.logo_url ? 'Change Logo' : 'Upload Logo'}
                            </>
                          )}
                        </button>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          JPEG, PNG, GIF, WebP, or SVG. Max 5MB.
                        </p>
                      </div>
                    </div>
                  </div>

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

              {/* Danger Zone - Owner Only */}
              {currentRole === 'owner' && (
                <>
                  <hr className="border-slate-200 dark:border-slate-700 mt-8" />
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Danger Zone
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                      These actions are irreversible. Please proceed with caution.
                    </p>

                    <div className="space-y-4">
                      {/* Transfer Ownership */}
                      <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-slate-900 dark:text-white">Transfer Ownership</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Transfer this workspace to another team member
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              fetchWorkspaceMembers()
                              setShowTransferModal(true)
                            }}
                            className="btn-outline text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          >
                            <UserCog className="h-4 w-4 mr-2" />
                            Transfer
                          </button>
                        </div>
                      </div>

                      {/* Delete Workspace */}
                      <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-900/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-slate-900 dark:text-white">Delete Workspace</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Permanently delete this workspace and all its data
                            </p>
                          </div>
                          <button
                            onClick={() => setShowDeleteModal(true)}
                            className="btn-outline text-red-600 border-red-300 hover:bg-red-100 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Delete Workspace Modal */}
              {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
                    <div className="flex items-center gap-3 text-red-600 mb-4">
                      <AlertTriangle className="h-6 w-6" />
                      <h3 className="text-lg font-semibold">Delete Workspace</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                      This action cannot be undone. This will permanently delete the workspace
                      <strong className="text-slate-900 dark:text-white"> {currentWorkspace?.name}</strong> and all associated data including clients, projects, and activities.
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                      Please type <strong className="text-slate-900 dark:text-white">{currentWorkspace?.name}</strong> to confirm.
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type workspace name to confirm"
                      className="input mb-4"
                    />
                    {deleteError && (
                      <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 text-sm">
                        {deleteError}
                      </div>
                    )}
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setShowDeleteModal(false)
                          setDeleteConfirmText('')
                          setDeleteError('')
                        }}
                        className="btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteWorkspace}
                        disabled={deleting || deleteConfirmText !== currentWorkspace?.name}
                        className="btn-primary bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                      >
                        {deleting ? 'Deleting...' : 'Delete Workspace'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Transfer Ownership Modal */}
              {showTransferModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
                    <div className="flex items-center gap-3 text-amber-600 mb-4">
                      <UserCog className="h-6 w-6" />
                      <h3 className="text-lg font-semibold">Transfer Ownership</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                      Transfer ownership of <strong className="text-slate-900 dark:text-white">{currentWorkspace?.name}</strong> to another team member. You will become an Admin after the transfer.
                    </p>
                    {workspaceMembers.length === 0 ? (
                      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                        No other team members to transfer ownership to. Invite team members first.
                      </p>
                    ) : (
                      <div className="mb-4">
                        <label className="label">Select New Owner</label>
                        <select
                          value={selectedNewOwner}
                          onChange={(e) => setSelectedNewOwner(e.target.value)}
                          className="input"
                        >
                          <option value="">Select a team member</option>
                          {workspaceMembers.map((member) => (
                            <option key={member.user_id} value={member.user_id}>
                              {member.full_name || member.email} ({member.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {transferError && (
                      <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 text-sm">
                        {transferError}
                      </div>
                    )}
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setShowTransferModal(false)
                          setSelectedNewOwner('')
                          setTransferError('')
                        }}
                        className="btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleTransferOwnership}
                        disabled={transferring || !selectedNewOwner}
                        className="btn-primary bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300"
                      >
                        {transferring ? 'Transferring...' : 'Transfer Ownership'}
                      </button>
                    </div>
                  </div>
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

          {activeTab === 'Integrations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Webhooks
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Configure webhooks for AI agent triggers and integrations
                  </p>
                </div>
                {(currentRole === 'owner' || currentRole === 'admin') && (
                  <button
                    onClick={() => setShowAddWebhook(true)}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Webhook
                  </button>
                )}
              </div>

              {/* Add Webhook Form */}
              {showAddWebhook && (
                <div className="card p-4 border-2 border-primary-200 dark:border-primary-800">
                  <h3 className="font-medium text-slate-900 dark:text-white mb-4">New Webhook</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">Name</label>
                      <input
                        type="text"
                        value={newWebhookName}
                        onChange={(e) => setNewWebhookName(e.target.value)}
                        placeholder="My Webhook"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">URL</label>
                      <input
                        type="url"
                        value={newWebhookUrl}
                        onChange={(e) => setNewWebhookUrl(e.target.value)}
                        placeholder="https://api.example.com/webhook"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Secret (Optional)</label>
                      <input
                        type="text"
                        value={newWebhookSecret}
                        onChange={(e) => setNewWebhookSecret(e.target.value)}
                        placeholder="webhook-secret-key"
                        className="input"
                      />
                      <p className="text-xs text-slate-500 mt-1">Used to sign webhook payloads</p>
                    </div>
                    <div>
                      <label className="label">Events</label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {webhookEvents.map((event) => (
                          <label
                            key={event.value}
                            className="flex items-center p-2 rounded border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <input
                              type="checkbox"
                              checked={newWebhookEvents.includes(event.value)}
                              onChange={() => toggleWebhookEvent(event.value)}
                              className="h-4 w-4 rounded text-primary-600 mr-2"
                            />
                            <span className="text-sm">{event.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddWebhook}
                        disabled={webhookSaving || !newWebhookName || !newWebhookUrl || newWebhookEvents.length === 0}
                        className="btn-primary"
                      >
                        {webhookSaving ? 'Saving...' : 'Save Webhook'}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddWebhook(false)
                          setNewWebhookName('')
                          setNewWebhookUrl('')
                          setNewWebhookSecret('')
                          setNewWebhookEvents([])
                        }}
                        className="btn-outline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Webhooks List */}
              {webhooksLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Webhook className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No webhooks configured yet</p>
                  <p className="text-sm">Add a webhook to integrate with AI agents and external services</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      className={clsx(
                        'card p-4 flex items-center justify-between',
                        !webhook.is_active && 'opacity-60'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-900 dark:text-white truncate">
                            {webhook.name}
                          </h4>
                          {webhook.is_active ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {webhook.url}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {webhook.events.map((event) => (
                            <span
                              key={event}
                              className="px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            >
                              {event}
                            </span>
                          ))}
                        </div>
                      </div>
                      {(currentRole === 'owner' || currentRole === 'admin') && (
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleToggleWebhook(webhook.id, webhook.is_active)}
                            className="icon-btn"
                            title={webhook.is_active ? 'Disable' : 'Enable'}
                          >
                            {webhook.is_active ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteWebhook(webhook.id)}
                            className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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

          {activeTab === 'Audit Log' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Audit Log
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    View recent changes and activities in your workspace
                  </p>
                </div>
                <button
                  onClick={fetchAuditLogs}
                  className="btn-outline min-h-[44px]"
                  disabled={auditLogsLoading}
                >
                  <RefreshCw className={clsx('h-4 w-4 mr-2', auditLogsLoading && 'animate-spin')} />
                  Refresh
                </button>
              </div>

              {auditLogsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">Loading audit logs...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No activity logs found</p>
                  <p className="text-sm">Activities will appear here when team members interact with clients</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case 'call': return <Phone className="h-4 w-4" />
                        case 'email': return <Mail className="h-4 w-4" />
                        case 'meeting': return <Calendar className="h-4 w-4" />
                        case 'note': return <FileText className="h-4 w-4" />
                        case 'status_change': return <RefreshCw className="h-4 w-4" />
                        default: return <ClipboardList className="h-4 w-4" />
                      }
                    }

                    const getActivityColor = (type: string) => {
                      switch (type) {
                        case 'call': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        case 'email': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                        case 'meeting': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                        case 'note': return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                        case 'status_change': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                        default: return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }
                    }

                    const formatDate = (dateString: string) => {
                      const date = new Date(dateString)
                      return date.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    }

                    return (
                      <div
                        key={log.id}
                        className="card p-4 flex items-start gap-4"
                      >
                        <div className={clsx(
                          'p-2 rounded-lg flex-shrink-0',
                          getActivityColor(log.type)
                        )}>
                          {getActivityIcon(log.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {log.user_name}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              logged a {log.type.replace('_', ' ')} for
                            </span>
                            <span className="font-medium text-primary-600 dark:text-primary-400">
                              {log.client_name}
                            </span>
                          </div>
                          {log.content && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                              {log.content}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {formatDate(log.created_at)}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <span className={clsx(
                            'px-2 py-1 text-xs rounded-full capitalize',
                            getActivityColor(log.type)
                          )}>
                            {log.type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* App Version Footer */}
      <div className="text-center text-sm text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-700">
        <p>Voost Level v0.1.0</p>
      </div>
    </div>
  )
}

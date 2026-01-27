import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Building2, Palette, Bell, Shield, Webhook, Plus, Trash2, Check, X, AlertTriangle, UserCog, ClipboardList, Phone, Mail, Calendar, FileText, RefreshCw, Upload, Camera, Sparkles, HelpCircle, ChevronDown, ChevronUp, Smartphone, Settings2, Edit2, GripVertical, Target, Code2, Eye, EyeOff, Copy, Key } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import api, { RateLimitHeaders } from '../lib/api'
import { getRecentDeliveries, clearRecentDeliveries, WebhookDelivery } from '../services/webhookService'
import type { Webhook as WebhookType, WorkspaceMember, Activity, CustomFieldDefinition, CustomFieldType, WorkspaceCustomFields, LeadScoringRule, LeadScoringConfig, LeadScoringCriteriaType } from '../types/database'
import { PWAInstallSection } from '../components/pwa/PWAInstallBanner'

const tabs = [
  { name: 'Profile', icon: User },
  { name: 'Workspace', icon: Building2 },
  { name: 'Custom Fields', icon: Settings2 },
  { name: 'Lead Scoring', icon: Target },
  { name: 'Appearance', icon: Palette },
  { name: 'Notifications', icon: Bell },
  { name: 'Integrations', icon: Webhook },
  { name: 'API', icon: Code2 },
  { name: 'Security', icon: Shield },
  { name: 'Audit Log', icon: ClipboardList },
  { name: "What's New", icon: Sparkles },
  { name: 'Help', icon: HelpCircle },
]

// Custom field type options
const customFieldTypeOptions: { value: CustomFieldType; label: string; description: string }[] = [
  { value: 'text', label: 'Text', description: 'Free-form text input' },
  { value: 'number', label: 'Number', description: 'Numeric values only' },
  { value: 'dropdown', label: 'Dropdown', description: 'Select from predefined options' },
  { value: 'date', label: 'Date', description: 'Date picker' },
]

// Lead scoring criteria options
const leadScoringCriteriaOptions: { value: LeadScoringCriteriaType; label: string; description: string; hasValue?: boolean; valueLabel?: string }[] = [
  { value: 'has_email', label: 'Has Email', description: 'Client has an email address' },
  { value: 'has_phone', label: 'Has Phone', description: 'Client has a phone number' },
  { value: 'has_company', label: 'Has Company', description: 'Client has a company name' },
  { value: 'has_website', label: 'Has Website', description: 'Client has a website URL' },
  { value: 'has_value', label: 'Has Deal Value', description: 'Client has a deal value set' },
  { value: 'value_above', label: 'Deal Value Above', description: 'Deal value is above a threshold', hasValue: true, valueLabel: 'Minimum value ($)' },
  { value: 'source_equals', label: 'Source Equals', description: 'Lead source matches a specific value', hasValue: true, valueLabel: 'Source name' },
  { value: 'has_projects', label: 'Has Projects', description: 'Client has one or more projects' },
  { value: 'recent_activity', label: 'Recent Activity', description: 'Has activity in last 30 days' },
]

// Default lead scoring rules
const defaultLeadScoringRules: LeadScoringRule[] = [
  { id: '1', type: 'has_email', points: 10, enabled: true },
  { id: '2', type: 'has_phone', points: 10, enabled: true },
  { id: '3', type: 'has_company', points: 5, enabled: true },
  { id: '4', type: 'has_website', points: 5, enabled: false },
  { id: '5', type: 'has_value', points: 15, enabled: true },
  { id: '6', type: 'value_above', points: 20, enabled: false, value: 10000 },
  { id: '7', type: 'has_projects', points: 25, enabled: true },
  { id: '8', type: 'recent_activity', points: 15, enabled: true },
]

// Help documentation sections
const helpSections = [
  {
    title: 'Getting Started',
    items: [
      {
        question: 'How do I add my first client?',
        answer: 'Navigate to the Clients page from the sidebar and click the "Add Client" button. Fill in the client details including name, email, company, and initial status. You can also add a value estimate for your pipeline.'
      },
      {
        question: 'How do I create a workspace?',
        answer: 'Click on the workspace selector in the top-left corner of the sidebar and select "Create Workspace". Give your workspace a name and it will be created immediately. You can then invite team members to collaborate.'
      },
    ]
  },
  {
    title: 'Client Management',
    items: [
      {
        question: 'How do I move clients through the pipeline?',
        answer: 'Go to the Pipeline page to see your Kanban board. Drag and drop client cards between stages (Lead, Contacted, Proposal, Negotiation, Won, Lost). You can also change status from the client detail page.'
      },
      {
        question: 'How do I log activities for a client?',
        answer: 'Open a client\'s detail page and navigate to the Activity tab. Click "Log Activity" and select the type (call, email, meeting, note, or task). Add any relevant notes and save.'
      },
      {
        question: 'How do I filter and search for clients?',
        answer: 'Use the search bar at the top of any page (Ctrl+K for quick access). On the Clients page, you can also filter by status, sort by different criteria, and switch between list and grid views.'
      },
    ]
  },
  {
    title: 'Projects & Tasks',
    items: [
      {
        question: 'How do I create a project for a client?',
        answer: 'Open the client detail page and go to the Projects tab. Click "Add Project" and fill in the project name, description, status, and dates. Projects help you track work associated with each client.'
      },
      {
        question: 'How do I manage project tasks?',
        answer: 'Open a project and you\'ll see the Tasks section. Click "Add Task" to create new tasks. You can check off completed tasks and filter by status.'
      },
    ]
  },
  {
    title: 'Team Collaboration',
    items: [
      {
        question: 'How do I invite team members?',
        answer: 'Go to the Team page and click "Invite Member". Enter their email address and select their role (Admin, Member, or Viewer). They\'ll receive an email invitation to join your workspace.'
      },
      {
        question: 'What are the different team roles?',
        answer: 'Owner: Full control including workspace deletion. Admin: Can manage settings and team. Member: Can manage clients and projects. Viewer: Read-only access to data.'
      },
    ]
  },
  {
    title: 'Dashboard & Reports',
    items: [
      {
        question: 'How do I customize my dashboard?',
        answer: 'Click the "Customize" button on the Dashboard page. You can show or hide different widgets like Statistics Cards, Recent Activity, and Pipeline Overview. Your preferences are saved automatically.'
      },
      {
        question: 'How do I export reports?',
        answer: 'Go to the Reports page and select your time range. Click "Export PDF" to generate a printable report with activity statistics, breakdown by type, and daily activity data.'
      },
    ]
  },
  {
    title: 'Keyboard Shortcuts',
    items: [
      {
        question: 'What keyboard shortcuts are available?',
        answer: 'Press Ctrl+K (or Cmd+K on Mac) to open the Command Palette for quick navigation. Use arrow keys to navigate and Enter to select. You can quickly jump to any page or search for clients.'
      },
    ]
  },
]

// Release notes data
const releaseNotes = [
  {
    version: '0.1.0',
    date: 'January 2026',
    title: 'Initial Release',
    highlights: [
      'Complete CRM functionality with clients, projects, and pipeline management',
      'Team collaboration with workspace invitations and role-based access',
      'Activity tracking with calls, emails, meetings, and notes',
      'Customizable dashboard with widget show/hide',
      'Dark mode and light mode themes',
      'Reports with activity trends and PDF export',
      'Real-time search across clients and projects',
      'Offline mode indicator',
      'Keyboard shortcuts with command palette (Ctrl+K)',
    ],
  },
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
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([])

  // Danger zone state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [workspaceMembers, setWorkspaceMembers] = useState<(WorkspaceMember & { email?: string; full_name?: string })[]>([])
  const [selectedNewOwner, setSelectedNewOwner] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<(Activity & { user_name?: string; client_name?: string })[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)

  // Help expandable items state
  const [expandedHelpItems, setExpandedHelpItems] = useState<Set<string>>(new Set())

  // Feedback form state
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'general'>('general')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  // Custom fields settings state
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<CustomFieldDefinition[]>([])
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false)
  const [showAddFieldModal, setShowAddFieldModal] = useState(false)
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [customFieldSaving, setCustomFieldSaving] = useState(false)

  // Lead scoring state
  const [leadScoringEnabled, setLeadScoringEnabled] = useState(false)
  const [leadScoringRules, setLeadScoringRules] = useState<LeadScoringRule[]>(defaultLeadScoringRules)
  const [leadScoringSaving, setLeadScoringSaving] = useState(false)
  const [showAddRuleModal, setShowAddRuleModal] = useState(false)
  const [newRuleType, setNewRuleType] = useState<LeadScoringCriteriaType>('has_email')
  const [newRulePoints, setNewRulePoints] = useState(10)
  const [newRuleValue, setNewRuleValue] = useState('')

  // API rate limit state
  const [rateLimitHeaders, setRateLimitHeaders] = useState<RateLimitHeaders | null>(null)
  const [apiTestLoading, setApiTestLoading] = useState(false)
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // API key state
  const [apiKey, setApiKey] = useState<string | null>(() => {
    return localStorage.getItem('voost_api_key')
  })
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [apiKeyGenerating, setApiKeyGenerating] = useState(false)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)

  // Generate a new API key
  const generateApiKey = () => {
    setApiKeyGenerating(true)
    // Simulate key generation with a random string
    const newKey = `vl_${Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}`
    setTimeout(() => {
      setApiKey(newKey)
      localStorage.setItem('voost_api_key', newKey)
      setApiKeyGenerating(false)
      setApiKeyVisible(true)
    }, 500)
  }

  // Rotate (regenerate) the API key
  const rotateApiKey = () => {
    if (confirm('Are you sure you want to rotate your API key? The old key will stop working immediately.')) {
      generateApiKey()
    }
  }

  // Copy API key to clipboard
  const copyApiKey = async () => {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey)
      setApiKeyCopied(true)
      setTimeout(() => setApiKeyCopied(false), 2000)
    }
  }

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

  // Refresh webhook deliveries when Integrations tab is active
  useEffect(() => {
    if (activeTab === 'Integrations') {
      setWebhookDeliveries(getRecentDeliveries())
      // Refresh every 5 seconds while on tab
      const interval = setInterval(() => {
        setWebhookDeliveries(getRecentDeliveries())
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [activeTab])

  // Fetch audit logs when tab changes to Audit Log
  useEffect(() => {
    if (activeTab === 'Audit Log' && currentWorkspace) {
      fetchAuditLogs()
    }
  }, [activeTab, currentWorkspace])

  // Fetch custom field definitions when tab changes to Custom Fields
  useEffect(() => {
    if (activeTab === 'Custom Fields' && currentWorkspace) {
      fetchCustomFields()
    }
  }, [activeTab, currentWorkspace])

  // Fetch lead scoring config when tab changes to Lead Scoring
  useEffect(() => {
    if (activeTab === 'Lead Scoring' && currentWorkspace) {
      fetchLeadScoringConfig()
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

  async function fetchCustomFields() {
    if (!currentWorkspace) return
    setCustomFieldsLoading(true)

    // Custom fields are stored in workspace settings
    const settings = currentWorkspace.settings as WorkspaceCustomFields | null
    const fields = settings?.fields || []
    setCustomFieldDefinitions(fields)
    setCustomFieldsLoading(false)
  }

  function generateFieldId() {
    return `field_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  async function handleSaveCustomField() {
    if (!currentWorkspace || !newFieldName.trim()) return
    setCustomFieldSaving(true)

    const newField: CustomFieldDefinition = {
      id: editingField?.id || generateFieldId(),
      name: newFieldName.trim(),
      type: newFieldType,
      required: newFieldRequired,
    }

    // Add options for dropdown type
    if (newFieldType === 'dropdown' && newFieldOptions.trim()) {
      newField.options = newFieldOptions.split(',').map(opt => opt.trim()).filter(Boolean)
    }

    let updatedFields: CustomFieldDefinition[]
    if (editingField) {
      // Update existing field
      updatedFields = customFieldDefinitions.map(f => f.id === editingField.id ? newField : f)
    } else {
      // Add new field
      updatedFields = [...customFieldDefinitions, newField]
    }

    const newSettings: WorkspaceCustomFields = {
      ...((currentWorkspace.settings as WorkspaceCustomFields) || {}),
      fields: updatedFields,
    }

    const { error } = await updateWorkspace(currentWorkspace.id, { settings: newSettings })

    if (!error) {
      setCustomFieldDefinitions(updatedFields)
      resetCustomFieldForm()
      showSuccess(editingField ? 'Custom field updated!' : 'Custom field added!')
    } else {
      showError('Failed to save custom field')
    }

    setCustomFieldSaving(false)
  }

  async function handleDeleteCustomField(fieldId: string) {
    if (!currentWorkspace) return

    const updatedFields = customFieldDefinitions.filter(f => f.id !== fieldId)
    const newSettings: WorkspaceCustomFields = {
      ...((currentWorkspace.settings as WorkspaceCustomFields) || {}),
      fields: updatedFields,
    }

    const { error } = await updateWorkspace(currentWorkspace.id, { settings: newSettings })

    if (!error) {
      setCustomFieldDefinitions(updatedFields)
      showSuccess('Custom field deleted')
    } else {
      showError('Failed to delete custom field')
    }
  }

  function resetCustomFieldForm() {
    setNewFieldName('')
    setNewFieldType('text')
    setNewFieldOptions('')
    setNewFieldRequired(false)
    setEditingField(null)
    setShowAddFieldModal(false)
  }

  function startEditField(field: CustomFieldDefinition) {
    setEditingField(field)
    setNewFieldName(field.name)
    setNewFieldType(field.type)
    setNewFieldOptions(field.options?.join(', ') || '')
    setNewFieldRequired(field.required || false)
    setShowAddFieldModal(true)
  }

  // Lead scoring functions
  async function fetchLeadScoringConfig() {
    if (!currentWorkspace) return

    // Lead scoring config is stored in workspace settings
    const settings = currentWorkspace.settings as { leadScoring?: LeadScoringConfig } | null
    if (settings?.leadScoring) {
      setLeadScoringEnabled(settings.leadScoring.enabled)
      setLeadScoringRules(settings.leadScoring.rules)
    } else {
      setLeadScoringEnabled(false)
      setLeadScoringRules(defaultLeadScoringRules)
    }
  }

  async function saveLeadScoringConfig() {
    if (!currentWorkspace) return
    setLeadScoringSaving(true)

    const leadScoringConfig: LeadScoringConfig = {
      enabled: leadScoringEnabled,
      rules: leadScoringRules,
    }

    const newSettings = {
      ...((currentWorkspace.settings as object) || {}),
      leadScoring: leadScoringConfig,
    }

    const { error } = await updateWorkspace(currentWorkspace.id, { settings: newSettings })

    if (!error) {
      showSuccess('Lead scoring settings saved!')
    } else {
      showError('Failed to save lead scoring settings')
    }

    setLeadScoringSaving(false)
  }

  function toggleLeadScoringEnabled() {
    setLeadScoringEnabled(!leadScoringEnabled)
  }

  function toggleRuleEnabled(ruleId: string) {
    setLeadScoringRules(rules =>
      rules.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    )
  }

  function updateRulePoints(ruleId: string, points: number) {
    setLeadScoringRules(rules =>
      rules.map(rule =>
        rule.id === ruleId ? { ...rule, points } : rule
      )
    )
  }

  function updateRuleValue(ruleId: string, value: string | number) {
    setLeadScoringRules(rules =>
      rules.map(rule =>
        rule.id === ruleId ? { ...rule, value } : rule
      )
    )
  }

  function deleteRule(ruleId: string) {
    setLeadScoringRules(rules => rules.filter(rule => rule.id !== ruleId))
  }

  function addNewRule() {
    const existingRule = leadScoringRules.find(r => r.type === newRuleType)
    if (existingRule && !['source_equals', 'value_above'].includes(newRuleType)) {
      showError('This rule type already exists')
      return
    }

    const newRule: LeadScoringRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: newRuleType,
      points: newRulePoints,
      enabled: true,
      value: newRuleValue || undefined,
    }

    setLeadScoringRules([...leadScoringRules, newRule])
    setShowAddRuleModal(false)
    setNewRuleType('has_email')
    setNewRulePoints(10)
    setNewRuleValue('')
    showSuccess('Rule added!')
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

  async function handleLeaveWorkspace() {
    if (!currentWorkspace || !user) return

    setLeaving(true)
    setLeaveError('')

    try {
      // Delete the membership record
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)

      if (error) throw error

      showSuccess('You have left the workspace')
      setShowLeaveModal(false)
      await refreshWorkspaces()
      navigate('/dashboard')
    } catch (err) {
      console.error('Error leaving workspace:', err)
      setLeaveError('Failed to leave workspace. Please try again.')
    } finally {
      setLeaving(false)
    }
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

              {/* Leave Workspace - Non-owners only */}
              {currentRole && currentRole !== 'owner' && (
                <>
                  <hr className="border-slate-200 dark:border-slate-700 mt-8" />
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Leave Workspace
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                      Remove yourself from this workspace. You will lose access to all workspace data.
                    </p>
                    <button
                      onClick={() => setShowLeaveModal(true)}
                      className="btn-outline text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Leave Workspace
                    </button>
                  </div>
                </>
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

              {/* Leave Workspace Modal */}
              {showLeaveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
                    <div className="flex items-center gap-3 text-amber-600 mb-4">
                      <AlertTriangle className="h-6 w-6" />
                      <h3 className="text-lg font-semibold">Leave Workspace</h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                      Are you sure you want to leave
                      <strong className="text-slate-900 dark:text-white"> {currentWorkspace?.name}</strong>?
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                      You will lose access to all workspace data. You can rejoin only if invited again by a workspace admin.
                    </p>
                    {leaveError && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                        {leaveError}
                      </div>
                    )}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => {
                          setShowLeaveModal(false)
                          setLeaveError('')
                        }}
                        disabled={leaving}
                        className="btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleLeaveWorkspace}
                        disabled={leaving}
                        className="btn-danger"
                      >
                        {leaving ? 'Leaving...' : 'Leave Workspace'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Custom Fields' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Custom Fields
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Define custom fields for client records with different data types
                  </p>
                </div>
                {(currentRole === 'owner' || currentRole === 'admin') && (
                  <button
                    onClick={() => {
                      resetCustomFieldForm()
                      setShowAddFieldModal(true)
                    }}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Field
                  </button>
                )}
              </div>

              {/* Add/Edit Field Modal */}
              {showAddFieldModal && (
                <div className="card p-4 border-2 border-primary-200 dark:border-primary-800">
                  <h3 className="font-medium text-slate-900 dark:text-white mb-4">
                    {editingField ? 'Edit Custom Field' : 'New Custom Field'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">Field Name</label>
                      <input
                        type="text"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        placeholder="e.g., Industry, Contract Date, Budget"
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="label">Field Type</label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {customFieldTypeOptions.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setNewFieldType(type.value)}
                            className={clsx(
                              'p-3 rounded-lg border text-left transition-colors',
                              newFieldType === type.value
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            )}
                          >
                            <div className="font-medium text-slate-900 dark:text-white text-sm">
                              {type.label}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {type.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {newFieldType === 'dropdown' && (
                      <div>
                        <label className="label">Dropdown Options</label>
                        <input
                          type="text"
                          value={newFieldOptions}
                          onChange={(e) => setNewFieldOptions(e.target.value)}
                          placeholder="Option 1, Option 2, Option 3 (comma-separated)"
                          className="input"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Enter options separated by commas
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newFieldRequired}
                          onChange={(e) => setNewFieldRequired(e.target.checked)}
                          className="h-4 w-4 rounded text-primary-600"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Required field
                        </span>
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveCustomField}
                        disabled={customFieldSaving || !newFieldName.trim() || (newFieldType === 'dropdown' && !newFieldOptions.trim())}
                        className="btn-primary"
                      >
                        {customFieldSaving ? 'Saving...' : (editingField ? 'Update Field' : 'Add Field')}
                      </button>
                      <button
                        onClick={resetCustomFieldForm}
                        className="btn-outline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Fields List */}
              {customFieldsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : customFieldDefinitions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Settings2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No custom fields defined yet</p>
                  <p className="text-sm">Add custom fields to capture additional client information</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customFieldDefinitions.map((field) => (
                    <div
                      key={field.id}
                      className="card p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-slate-900 dark:text-white truncate">
                              {field.name}
                            </h4>
                            {field.required && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                Required
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 capitalize">
                              {field.type}
                            </span>
                            {field.type === 'dropdown' && field.options && (
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                Options: {field.options.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {(currentRole === 'owner' || currentRole === 'admin') && (
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => startEditField(field)}
                            className="icon-btn"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomField(field.id)}
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

              {currentRole !== 'owner' && currentRole !== 'admin' && (
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  You don't have permission to manage custom fields. Contact your workspace admin.
                </p>
              )}
            </div>
          )}

          {activeTab === 'Lead Scoring' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Lead Scoring
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Configure rules to automatically score leads based on their data completeness and engagement
                  </p>
                </div>
                <button
                  onClick={toggleLeadScoringEnabled}
                  className={clsx(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    leadScoringEnabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      leadScoringEnabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {leadScoringEnabled && (
                <>
                  {/* Add Rule Button */}
                  {(currentRole === 'owner' || currentRole === 'admin') && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setShowAddRuleModal(true)}
                        className="btn-outline"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Rule
                      </button>
                    </div>
                  )}

                  {/* Add Rule Modal */}
                  {showAddRuleModal && (
                    <div className="card p-4 border-2 border-primary-200 dark:border-primary-800">
                      <h3 className="font-medium text-slate-900 dark:text-white mb-4">
                        Add Scoring Rule
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="label">Criteria</label>
                          <select
                            value={newRuleType}
                            onChange={(e) => {
                              setNewRuleType(e.target.value as LeadScoringCriteriaType)
                              setNewRuleValue('')
                            }}
                            className="input"
                          >
                            {leadScoringCriteriaOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label} - {option.description}
                              </option>
                            ))}
                          </select>
                        </div>

                        {leadScoringCriteriaOptions.find(o => o.value === newRuleType)?.hasValue && (
                          <div>
                            <label className="label">
                              {leadScoringCriteriaOptions.find(o => o.value === newRuleType)?.valueLabel}
                            </label>
                            <input
                              type={newRuleType === 'value_above' ? 'number' : 'text'}
                              value={newRuleValue}
                              onChange={(e) => setNewRuleValue(e.target.value)}
                              placeholder={newRuleType === 'value_above' ? 'Enter minimum value' : 'Enter value'}
                              className="input"
                            />
                          </div>
                        )}

                        <div>
                          <label className="label">Points</label>
                          <input
                            type="number"
                            value={newRulePoints}
                            onChange={(e) => setNewRulePoints(parseInt(e.target.value) || 0)}
                            min={1}
                            max={100}
                            className="input w-32"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={addNewRule}
                            disabled={!newRuleType || (leadScoringCriteriaOptions.find(o => o.value === newRuleType)?.hasValue && !newRuleValue)}
                            className="btn-primary"
                          >
                            Add Rule
                          </button>
                          <button
                            onClick={() => {
                              setShowAddRuleModal(false)
                              setNewRuleType('has_email')
                              setNewRulePoints(10)
                              setNewRuleValue('')
                            }}
                            className="btn-outline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rules List */}
                  <div className="space-y-3">
                    {leadScoringRules.map((rule) => {
                      const criteriaOption = leadScoringCriteriaOptions.find(o => o.value === rule.type)
                      return (
                        <div
                          key={rule.id}
                          className={clsx(
                            'card p-4 flex items-center justify-between',
                            !rule.enabled && 'opacity-50'
                          )}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <button
                              onClick={() => toggleRuleEnabled(rule.id)}
                              className={clsx(
                                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                                rule.enabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
                              )}
                            >
                              <span
                                className={clsx(
                                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                                  rule.enabled ? 'translate-x-5' : 'translate-x-1'
                                )}
                              />
                            </button>
                            <div className="flex-1">
                              <div className="font-medium text-slate-900 dark:text-white">
                                {criteriaOption?.label || rule.type}
                              </div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">
                                {criteriaOption?.description}
                                {rule.value && `: ${rule.type === 'value_above' ? '$' + Number(rule.value).toLocaleString() : rule.value}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-500">Points:</span>
                              <input
                                type="number"
                                value={rule.points}
                                onChange={(e) => updateRulePoints(rule.id, parseInt(e.target.value) || 0)}
                                min={1}
                                max={100}
                                className="input w-20 text-center"
                              />
                            </div>
                            {(currentRole === 'owner' || currentRole === 'admin') && (
                              <button
                                onClick={() => deleteRule(rule.id)}
                                className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Delete rule"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Save Button */}
                  {(currentRole === 'owner' || currentRole === 'admin') && (
                    <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={saveLeadScoringConfig}
                        disabled={leadScoringSaving}
                        className="btn-primary"
                      >
                        {leadScoringSaving ? 'Saving...' : 'Save Lead Scoring Rules'}
                      </button>
                    </div>
                  )}

                  {/* Max Score Info */}
                  <div className="card p-4 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Target className="h-4 w-4" />
                      <span>
                        Maximum possible score:{' '}
                        <strong>
                          {leadScoringRules.filter(r => r.enabled).reduce((sum, r) => sum + r.points, 0)} points
                        </strong>
                      </span>
                    </div>
                  </div>
                </>
              )}

              {!leadScoringEnabled && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Lead scoring is disabled</p>
                  <p className="text-sm">Enable to automatically score leads based on configurable criteria</p>
                </div>
              )}

              {currentRole !== 'owner' && currentRole !== 'admin' && (
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  You don't have permission to manage lead scoring. Contact your workspace admin.
                </p>
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

              <hr className="border-slate-200 dark:border-slate-700" />

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  <h3 className="text-md font-semibold text-slate-900 dark:text-white">
                    Install App
                  </h3>
                </div>
                <PWAInstallSection />
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

              {/* Webhook Delivery Log */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-white">
                      Recent Webhook Deliveries
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      View recent webhook activity and delivery status
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWebhookDeliveries(getRecentDeliveries())}
                      className="btn-outline text-sm py-1.5 px-3"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </button>
                    {webhookDeliveries.length > 0 && (
                      <button
                        onClick={() => {
                          clearRecentDeliveries()
                          setWebhookDeliveries([])
                        }}
                        className="btn-outline text-sm py-1.5 px-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Clear Log
                      </button>
                    )}
                  </div>
                </div>

                {webhookDeliveries.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No webhook deliveries yet</p>
                    <p className="text-xs mt-1">Deliveries will appear here when webhooks are triggered</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {webhookDeliveries.map((delivery, index) => (
                      <div
                        key={`${delivery.webhookId}-${delivery.timestamp}-${index}`}
                        className={clsx(
                          'p-3 rounded-lg border',
                          delivery.status === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : delivery.status === 'failed'
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={clsx(
                                'px-2 py-0.5 text-xs rounded-full font-medium',
                                delivery.status === 'success'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                                  : delivery.status === 'failed'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                              )}>
                                {delivery.status.toUpperCase()}
                              </span>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {delivery.webhookName}
                              </span>
                              <span className="px-1.5 py-0.5 text-xs rounded bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                                {delivery.event}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">
                              {delivery.url}
                            </p>
                            {delivery.statusCode && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                HTTP {delivery.statusCode}
                                {delivery.error && ` - ${delivery.error}`}
                              </p>
                            )}
                            {delivery.error && !delivery.statusCode && (
                              <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                                Error: {delivery.error}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap ml-2">
                            {new Date(delivery.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

          {activeTab === 'API' && (
            <div className="space-y-6">
              {/* API Key Management */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  API Key Management
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Generate and manage your API keys for external integrations
                </p>
              </div>

              <div className="card p-4">
                <h3 className="font-medium text-slate-900 dark:text-white mb-4">Your API Key</h3>
                {apiKey ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg font-mono text-sm break-all">
                        {apiKeyVisible ? apiKey : '•'.repeat(48)}
                      </div>
                      <button
                        onClick={() => setApiKeyVisible(!apiKeyVisible)}
                        className="btn-outline p-2"
                        title={apiKeyVisible ? 'Hide key' : 'Show key'}
                      >
                        {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={copyApiKey}
                        className="btn-outline p-2"
                        title="Copy to clipboard"
                      >
                        {apiKeyCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={rotateApiKey}
                        className="btn-outline text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        disabled={apiKeyGenerating}
                      >
                        <RefreshCw className={clsx('h-4 w-4 mr-2', apiKeyGenerating && 'animate-spin')} />
                        Rotate Key
                      </button>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Rotating will invalidate your current key immediately
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      You haven't generated an API key yet. Generate one to start using the API.
                    </p>
                    <button
                      onClick={generateApiKey}
                      className="btn-primary"
                      disabled={apiKeyGenerating}
                    >
                      {apiKeyGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4 mr-2" />
                          Generate API Key
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  API Rate Limiting
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Monitor your API usage and rate limit status
                </p>
              </div>

              {/* Rate Limit Status */}
              <div className="card p-4">
                <h3 className="font-medium text-slate-900 dark:text-white mb-4">Current Rate Limit Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm text-slate-500 dark:text-slate-400">X-RateLimit-Limit</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {rateLimitHeaders?.['X-RateLimit-Limit'] || api.getRateLimitStatus()['X-RateLimit-Limit']}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Maximum requests per window</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm text-slate-500 dark:text-slate-400">X-RateLimit-Remaining</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {rateLimitHeaders?.['X-RateLimit-Remaining'] || api.getRateLimitStatus()['X-RateLimit-Remaining']}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Requests remaining in window</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm text-slate-500 dark:text-slate-400">X-RateLimit-Reset</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {rateLimitHeaders?.['X-RateLimit-Reset'] || api.getRateLimitStatus()['X-RateLimit-Reset']}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Unix timestamp of reset</p>
                  </div>
                </div>

                {rateLimitHeaders?.['Retry-After'] && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      Rate limit exceeded. Retry after {rateLimitHeaders['Retry-After']} seconds.
                    </p>
                  </div>
                )}
              </div>

              {/* Test API Request */}
              <div className="card p-4">
                <h3 className="font-medium text-slate-900 dark:text-white mb-4">Test API Request</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Make a test API request to see the rate limit headers in action.
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={async () => {
                      setApiTestLoading(true)
                      setApiTestResult(null)
                      try {
                        const response = await api.getClients(currentWorkspace?.id || '')
                        setRateLimitHeaders(response.headers)
                        if (response.error) {
                          setApiTestResult({
                            success: false,
                            message: response.error.message || 'Request failed'
                          })
                        } else {
                          setApiTestResult({
                            success: true,
                            message: `Successfully fetched ${response.data?.length || 0} clients`
                          })
                        }
                      } catch (error) {
                        setApiTestResult({
                          success: false,
                          message: 'Request failed'
                        })
                      }
                      setApiTestLoading(false)
                    }}
                    disabled={apiTestLoading || !currentWorkspace}
                    className="btn-primary"
                  >
                    {apiTestLoading ? 'Making Request...' : 'Make Test Request'}
                  </button>
                  <button
                    onClick={() => {
                      setRateLimitHeaders(api.getRateLimitStatus())
                      setApiTestResult(null)
                    }}
                    className="btn-outline"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Status
                  </button>
                </div>

                {apiTestResult && (
                  <div className={clsx(
                    'mt-4 p-3 rounded-lg border',
                    apiTestResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  )}>
                    <p className={clsx(
                      'text-sm',
                      apiTestResult.success
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}>
                      {apiTestResult.success ? (
                        <Check className="h-4 w-4 inline mr-2" />
                      ) : (
                        <X className="h-4 w-4 inline mr-2" />
                      )}
                      {apiTestResult.message}
                    </p>
                  </div>
                )}
              </div>

              {/* Rate Limit Headers Documentation */}
              <div className="card p-4">
                <h3 className="font-medium text-slate-900 dark:text-white mb-4">Rate Limit Headers</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Every API response includes these rate limiting headers:
                </p>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <code className="text-sm font-mono text-primary-600 dark:text-primary-400">X-RateLimit-Limit</code>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      The maximum number of requests allowed per time window.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <code className="text-sm font-mono text-primary-600 dark:text-primary-400">X-RateLimit-Remaining</code>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      The number of requests remaining in the current time window.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <code className="text-sm font-mono text-primary-600 dark:text-primary-400">X-RateLimit-Reset</code>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Unix timestamp (in seconds) when the rate limit window resets.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <code className="text-sm font-mono text-primary-600 dark:text-primary-400">Retry-After</code>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Only present when rate limited. Indicates seconds until the limit resets.
                    </p>
                  </div>
                </div>
              </div>

              {/* API Rate Limit Configuration */}
              <div className="card p-4">
                <h3 className="font-medium text-slate-900 dark:text-white mb-4">Rate Limit Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Requests per window</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">100 requests</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Window duration</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">1 minute</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                  Contact support if you need higher rate limits for your API integration.
                </p>
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

          {activeTab === "What's New" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  What's New
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  See the latest updates and improvements to Voost Level
                </p>
              </div>

              <div className="space-y-8">
                {releaseNotes.map((release) => (
                  <div key={release.version} className="border-l-4 border-primary-500 pl-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-semibold">
                        v{release.version}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {release.date}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">
                      {release.title}
                    </h3>
                    <ul className="space-y-2">
                      {release.highlights.map((highlight, index) => (
                        <li key={index} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Have feedback or feature requests? We'd love to hear from you! Contact us at{' '}
                  <a href="mailto:support@voostlevel.com" className="text-primary-600 dark:text-primary-400 hover:underline">
                    support@voostlevel.com
                  </a>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'Help' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Help & Documentation
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Find answers to common questions and learn how to use Voost Level
                </p>
              </div>

              <div className="space-y-6">
                {helpSections.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-3">
                      {section.title}
                    </h3>
                    <div className="space-y-2">
                      {section.items.map((item, index) => {
                        const itemKey = `${section.title}-${index}`
                        const isExpanded = expandedHelpItems.has(itemKey)
                        return (
                          <div
                            key={itemKey}
                            className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                          >
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedHelpItems)
                                if (isExpanded) {
                                  newExpanded.delete(itemKey)
                                } else {
                                  newExpanded.add(itemKey)
                                }
                                setExpandedHelpItems(newExpanded)
                              }}
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <span className="font-medium text-slate-900 dark:text-white">
                                {item.question}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-slate-400 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 text-slate-600 dark:text-slate-300 text-sm">
                                {item.answer}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Feedback Form */}
              <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Send Feedback
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Help us improve Voost Level by sharing your thoughts, reporting bugs, or suggesting features.
                </p>

                {feedbackSubmitted ? (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">Thank you for your feedback!</span>
                    </div>
                    <p className="text-sm mt-1">We appreciate you taking the time to help us improve.</p>
                    <button
                      onClick={() => {
                        setFeedbackSubmitted(false)
                        setFeedbackText('')
                        setFeedbackType('general')
                      }}
                      className="text-sm underline mt-2"
                    >
                      Submit another
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="label">Feedback Type</label>
                      <div className="flex gap-2 mt-1">
                        {[
                          { value: 'general', label: 'General' },
                          { value: 'bug', label: 'Bug Report' },
                          { value: 'feature', label: 'Feature Request' },
                        ].map((type) => (
                          <button
                            key={type.value}
                            onClick={() => setFeedbackType(type.value as 'bug' | 'feature' | 'general')}
                            className={clsx(
                              'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                              feedbackType === type.value
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            )}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="feedbackText" className="label">Your Feedback</label>
                      <textarea
                        id="feedbackText"
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Tell us what you think..."
                        rows={4}
                        className="input resize-none"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!feedbackText.trim()) return
                        setFeedbackSubmitting(true)
                        // Simulate API call
                        await new Promise(resolve => setTimeout(resolve, 1000))
                        setFeedbackSubmitting(false)
                        setFeedbackSubmitted(true)
                        showSuccess('Feedback submitted successfully!')
                      }}
                      disabled={feedbackSubmitting || !feedbackText.trim()}
                      className="btn-primary"
                    >
                      {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <h4 className="font-medium text-primary-900 dark:text-primary-100 mb-2">
                  Need more help?
                </h4>
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  Can't find what you're looking for? Contact our support team at{' '}
                  <a href="mailto:support@voostlevel.com" className="underline font-medium">
                    support@voostlevel.com
                  </a>
                </p>
              </div>
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

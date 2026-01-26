import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ArrowRight, ArrowLeft, Sparkles, Users, UserPlus, Check, SkipForward } from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import type { ClientStatus, WorkspaceRole } from '../types/database'

type OnboardingStep = 'workspace' | 'client' | 'team'

// Store onboarding state outside component to persist across re-renders
const onboardingState = {
  step: 'workspace' as OnboardingStep,
  workspaceCreated: false,
  clientCreated: false,
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { createWorkspace, currentWorkspace, inviteMember, workspaces } = useWorkspace()
  const { profile, user } = useAuth()

  // Initialize from stored state
  const [step, setStepState] = useState<OnboardingStep>(onboardingState.step)

  // Wrapper to persist step changes
  const setStep = (newStep: OnboardingStep) => {
    onboardingState.step = newStep
    setStepState(newStep)
  }

  // If user already has workspaces and we're on workspace step,
  // check if we should advance to the next step
  useEffect(() => {
    if (onboardingState.workspaceCreated && currentWorkspace && step === 'workspace') {
      setStep('client')
    }
  }, [currentWorkspace, step])

  // Workspace step state
  const [agencyName, setAgencyName] = useState('')
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')

  // Client step state
  const [clientName, setClientName] = useState('')
  const [clientCompany, setClientCompany] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientStatus, setClientStatus] = useState<ClientStatus>('lead')
  const [clientValue, setClientValue] = useState('')
  const [clientSource, setClientSource] = useState('')
  const [clientLoading, setClientLoading] = useState(false)
  const [clientError, setClientError] = useState('')
  const [clientCreated, setClientCreated] = useState(false)

  // Team step state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSent, setInviteSent] = useState(false)

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!agencyName.trim()) return

    setWorkspaceLoading(true)
    setWorkspaceError('')

    const slug = generateSlug(agencyName)
    const { error: createError } = await createWorkspace(agencyName.trim(), slug)

    if (createError) {
      setWorkspaceError(createError.message || 'Failed to create workspace')
      setWorkspaceLoading(false)
      return
    }

    // Mark workspace as created to persist across re-renders
    onboardingState.workspaceCreated = true
    setWorkspaceLoading(false)
    // Move to client step
    setStep('client')
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault()

    if (!clientName.trim()) {
      setClientError('Client name is required')
      return
    }

    if (!currentWorkspace || !user) {
      setClientError('No workspace selected')
      return
    }

    setClientLoading(true)
    setClientError('')

    const { error: insertError } = await supabase
      .from('clients')
      .insert({
        workspace_id: currentWorkspace.id,
        name: clientName.trim(),
        company: clientCompany.trim() || null,
        email: clientEmail.trim() || null,
        phone: clientPhone.trim() || null,
        status: clientStatus,
        value: clientValue ? parseFloat(clientValue) : null,
        source: clientSource.trim() || null,
        created_by: user.id,
      })

    if (insertError) {
      setClientError(insertError.message || 'Failed to create client')
      setClientLoading(false)
    } else {
      setClientCreated(true)
      onboardingState.clientCreated = true
      setClientLoading(false)
      // Move to team step after short delay
      setTimeout(() => {
        setStep('team')
      }, 1000)
    }
  }

  async function handleInviteTeamMember(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')

    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail)) {
      setInviteError('Please enter a valid email address')
      return
    }

    setInviteLoading(true)
    const { error } = await inviteMember(inviteEmail.trim(), inviteRole)

    if (error) {
      setInviteError(error.message || 'Failed to send invitation')
      setInviteLoading(false)
    } else {
      setInviteSent(true)
      setInviteLoading(false)
      // Navigate to dashboard after success
      setTimeout(() => {
        resetOnboardingState()
        navigate('/dashboard')
      }, 1500)
    }
  }

  function resetOnboardingState() {
    onboardingState.step = 'workspace'
    onboardingState.workspaceCreated = false
    onboardingState.clientCreated = false
  }

  function handleSkipTeamInvite() {
    resetOnboardingState()
    navigate('/dashboard')
  }

  function getStepNumber(): number {
    switch (step) {
      case 'workspace': return 1
      case 'client': return 2
      case 'team': return 3
      default: return 1
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo and Welcome */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 text-white mb-4">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Welcome to Voost Level
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {profile?.full_name ? `Hi ${profile.full_name}! ` : ''}Let's get you started in just a few steps.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['workspace', 'client', 'team'].map((s, index) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  getStepNumber() > index + 1
                    ? 'bg-secondary text-white'
                    : getStepNumber() === index + 1
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {getStepNumber() > index + 1 ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < 2 && (
                <div
                  className={`w-12 h-1 mx-1 rounded ${
                    getStepNumber() > index + 1
                      ? 'bg-secondary'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="card p-8">
          {/* Step 1: Create Workspace */}
          {step === 'workspace' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Step 1: Create Your Agency
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Your workspace is where you'll manage clients and projects
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                {workspaceError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
                    {workspaceError}
                  </div>
                )}

                <div>
                  <label htmlFor="agencyName" className="label">
                    Agency Name
                  </label>
                  <input
                    id="agencyName"
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="e.g., Acme Digital Agency"
                    className="input"
                    autoFocus
                    required
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    This is how your agency will appear throughout the app
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={workspaceLoading || !agencyName.trim()}
                  className="btn-primary w-full justify-center"
                >
                  {workspaceLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Creating...</span>
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* Step 2: Create First Client */}
          {step === 'client' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Step 2: Add Your First Client
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Get started by adding your first client or lead
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateClient} className="space-y-4">
                {clientError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
                    {clientError}
                  </div>
                )}

                {clientCreated && (
                  <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Client created successfully!
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="clientName" className="label">
                      Client Name *
                    </label>
                    <input
                      id="clientName"
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="input"
                      placeholder="John Smith"
                      autoFocus
                      disabled={clientCreated}
                    />
                  </div>

                  <div>
                    <label htmlFor="clientCompany" className="label">
                      Company
                    </label>
                    <input
                      id="clientCompany"
                      type="text"
                      value={clientCompany}
                      onChange={(e) => setClientCompany(e.target.value)}
                      className="input"
                      placeholder="Acme Inc."
                      disabled={clientCreated}
                    />
                  </div>

                  <div>
                    <label htmlFor="clientEmail" className="label">
                      Email
                    </label>
                    <input
                      id="clientEmail"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="input"
                      placeholder="john@example.com"
                      disabled={clientCreated}
                    />
                  </div>

                  <div>
                    <label htmlFor="clientPhone" className="label">
                      Phone
                    </label>
                    <input
                      id="clientPhone"
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="input"
                      placeholder="+1 (555) 000-0000"
                      disabled={clientCreated}
                    />
                  </div>

                  <div>
                    <label htmlFor="clientStatus" className="label">
                      Status
                    </label>
                    <select
                      id="clientStatus"
                      value={clientStatus}
                      onChange={(e) => setClientStatus(e.target.value as ClientStatus)}
                      className="input"
                      disabled={clientCreated}
                    >
                      <option value="lead">Lead</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="churned">Churned</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="clientValue" className="label">
                      Deal Value ($)
                    </label>
                    <input
                      id="clientValue"
                      type="number"
                      value={clientValue}
                      onChange={(e) => setClientValue(e.target.value)}
                      className="input"
                      placeholder="10000"
                      min="0"
                      step="0.01"
                      disabled={clientCreated}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="clientSource" className="label">
                      Lead Source
                    </label>
                    <input
                      id="clientSource"
                      type="text"
                      value={clientSource}
                      onChange={(e) => setClientSource(e.target.value)}
                      className="input"
                      placeholder="Website, Referral, Social Media, etc."
                      disabled={clientCreated}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={clientLoading || !clientName.trim() || clientCreated}
                  className="btn-primary w-full justify-center"
                >
                  {clientLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Creating...</span>
                    </>
                  ) : clientCreated ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Moving to next step...
                    </>
                  ) : (
                    <>
                      Add Client & Continue
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* Step 3: Invite Team (Optional) */}
          {step === 'team' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Step 3: Invite Your Team
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Optionally invite team members to collaborate
                  </p>
                </div>
              </div>

              <form onSubmit={handleInviteTeamMember} className="space-y-4">
                {inviteError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-500 dark:text-red-400 text-sm">
                    {inviteError}
                  </div>
                )}

                {inviteSent && (
                  <div className="p-3 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-lg text-secondary dark:text-secondary-400 text-sm flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Invitation sent! Redirecting to dashboard...
                  </div>
                )}

                <div>
                  <label htmlFor="inviteEmail" className="label">
                    Email Address
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="input"
                    placeholder="colleague@example.com"
                    autoFocus
                    disabled={inviteSent}
                  />
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    They'll receive an email invitation to join your workspace
                  </p>
                </div>

                <div>
                  <label htmlFor="inviteRole" className="label">
                    Role
                  </label>
                  <select
                    id="inviteRole"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                    className="input"
                    disabled={inviteSent}
                  >
                    <option value="admin">Admin - Can manage team, clients, and projects</option>
                    <option value="member">Member - Can create and edit clients and projects</option>
                    <option value="viewer">Viewer - Read-only access</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSkipTeamInvite}
                    disabled={inviteLoading || inviteSent}
                    className="btn-outline flex-1 justify-center"
                  >
                    <SkipForward className="h-5 w-5 mr-2" />
                    Skip for Now
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading || !inviteEmail.trim() || inviteSent}
                    className="btn-primary flex-1 justify-center"
                  >
                    {inviteLoading ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Sending...</span>
                      </>
                    ) : inviteSent ? (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        Sent!
                      </>
                    ) : (
                      <>
                        Send Invite
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You can always invite more team members later from the Team page
                </p>
              </div>
            </>
          )}

          {/* What you'll be able to do - only shown in workspace step */}
          {step === 'workspace' && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                What you'll be able to do:
              </h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  Manage all your clients in one place
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  Track projects and tasks
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  Visualize your sales pipeline
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  Invite team members to collaborate
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  Integrate with AI agents
                </li>
              </ul>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          {step === 'workspace' && 'You can create additional workspaces later from the sidebar'}
          {step === 'client' && 'You can add more clients anytime from the Clients page'}
          {step === 'team' && 'Almost done! Just one more optional step.'}
        </p>
      </div>
    </div>
  )
}

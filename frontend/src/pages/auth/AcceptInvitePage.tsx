import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Building2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'

interface Invitation {
  id: string
  workspace_id: string
  email: string
  role: 'admin' | 'member' | 'viewer'
  expires_at: string
  accepted_at: string | null
  workspace: {
    id: string
    name: string
    logo_url: string | null
  }
}

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { refreshWorkspaces } = useWorkspace()

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (token) {
      fetchInvitation()
    }
  }, [token])

  async function fetchInvitation() {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('workspace_invitations')
      .select(`
        *,
        workspace:workspaces(id, name, logo_url)
      `)
      .eq('token', token)
      .single()

    if (fetchError || !data) {
      setError('Invalid or expired invitation link')
      setLoading(false)
      return
    }

    // Check if already accepted
    if (data.accepted_at) {
      setError('This invitation has already been accepted')
      setLoading(false)
      return
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      setError('This invitation has expired')
      setLoading(false)
      return
    }

    setInvitation(data as Invitation)
    setLoading(false)
  }

  async function handleAcceptInvitation() {
    if (!invitation || !user) return

    // Check if the logged-in user's email matches the invitation
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (profile?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      setError(`This invitation was sent to ${invitation.email}. Please log in with that email address.`)
      return
    }

    setAccepting(true)
    setError(null)

    try {
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', invitation.workspace_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        setError('You are already a member of this workspace')
        setAccepting(false)
        return
      }

      // Add user to workspace
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: invitation.role,
          invited_at: invitation.created_at,
          joined_at: new Date().toISOString(),
        })

      if (memberError) {
        throw memberError
      }

      // Mark invitation as accepted
      await supabase
        .from('workspace_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      // Refresh workspaces to include the new one
      await refreshWorkspaces()

      setSuccess(true)

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    } catch (err) {
      console.error('Error accepting invitation:', err)
      setError('Failed to accept invitation. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
          <p className="mt-2 text-slate-600 dark:text-slate-400">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Invitation Error
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
            <div className="space-y-3">
              {!user && (
                <Link to="/login" className="btn-primary w-full block">
                  Log In
                </Link>
              )}
              <Link to="/dashboard" className="btn-outline w-full block">
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Welcome to {invitation?.workspace.name}!
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You have successfully joined the workspace as a {invitation?.role}.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    // User needs to log in or register first
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
            <div className="text-center mb-6">
              {invitation?.workspace.logo_url ? (
                <img
                  src={invitation.workspace.logo_url}
                  alt={invitation.workspace.name}
                  className="h-16 w-16 rounded-lg object-cover mx-auto mb-4"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                </div>
              )}
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                You've been invited!
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Join <strong>{invitation?.workspace.name}</strong> as a <strong>{invitation?.role}</strong>
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Invitation sent to: <strong>{invitation?.email}</strong>
              </p>
            </div>

            <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
              Please log in or create an account to accept this invitation.
            </p>

            <div className="space-y-3">
              <Link
                to={`/login?redirect=/invite/${token}`}
                className="btn-primary w-full block text-center"
              >
                Log In
              </Link>
              <Link
                to={`/register?redirect=/invite/${token}&email=${encodeURIComponent(invitation?.email || '')}`}
                className="btn-outline w-full block text-center"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            {invitation?.workspace.logo_url ? (
              <img
                src={invitation.workspace.logo_url}
                alt={invitation.workspace.name}
                className="h-16 w-16 rounded-lg object-cover mx-auto mb-4"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
            )}
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Join {invitation?.workspace.name}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              You've been invited to join as a <strong>{invitation?.role}</strong>
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <p>
                <span className="font-medium">Role:</span>{' '}
                {invitation?.role === 'admin' && 'Admin - Can manage team, clients, and projects'}
                {invitation?.role === 'member' && 'Member - Can create and edit clients and projects'}
                {invitation?.role === 'viewer' && 'Viewer - Read-only access'}
              </p>
            </div>
          </div>

          <button
            onClick={handleAcceptInvitation}
            disabled={accepting}
            className="btn-primary w-full flex items-center justify-center"
          >
            {accepting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Joining...
              </>
            ) : (
              'Accept Invitation'
            )}
          </button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
            By accepting, you agree to join this workspace and collaborate with its members.
          </p>
        </div>
      </div>
    </div>
  )
}

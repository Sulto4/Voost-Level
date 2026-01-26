import { useState, useEffect, useRef } from 'react'
import { Plus, MoreHorizontal, Mail, Shield, Clock, X, ChevronDown, UserMinus, Loader2 } from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { InviteMemberModal } from '../components/team/InviteMemberModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { supabase } from '../lib/supabase'
import type { WorkspaceRole } from '../types/database'

interface TeamMember {
  id: string
  user_id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  role: WorkspaceRole
  joined_at: string | null
}

export function TeamPage() {
  const { currentWorkspace, currentRole, pendingInvitations, cancelInvitation, updateMemberRole, removeMember } = useWorkspace()
  const { user } = useAuth()
  const toast = useToast()
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [removingMember, setRemovingMember] = useState(false)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  const canInvite = currentRole === 'owner' || currentRole === 'admin'
  const canChangeRoles = currentRole === 'owner'

  // Viewers cannot access team management
  if (currentRole === 'viewer') {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 mx-auto text-slate-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Access Restricted
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          You don't have permission to access team management. Contact your workspace admin for access.
        </p>
      </div>
    )
  }

  // Fetch workspace members
  useEffect(() => {
    if (currentWorkspace) {
      fetchMembers()
    } else {
      setMembers([])
      setLoading(false)
    }
  }, [currentWorkspace?.id])

  // Close action menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchMembers() {
    if (!currentWorkspace) return

    setLoading(true)
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        profile:profiles(full_name, email, avatar_url)
      `)
      .eq('workspace_id', currentWorkspace.id)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('Error fetching members:', error)
      setLoading(false)
      return
    }

    const teamMembers: TeamMember[] = (data || []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      full_name: m.profile?.full_name || null,
      email: m.profile?.email || null,
      avatar_url: m.profile?.avatar_url || null,
      role: m.role,
      joined_at: m.joined_at,
    }))

    setMembers(teamMembers)
    setLoading(false)
  }

  async function handleChangeRole(memberId: string, newRole: WorkspaceRole) {
    setChangingRole(memberId)
    const { error } = await updateMemberRole(memberId, newRole)

    if (error) {
      toast.error(error.message || 'Failed to change role')
    } else {
      toast.success('Role updated successfully')
      await fetchMembers()
    }

    setChangingRole(null)
    setActionMenuOpen(null)
  }

  function openRemoveDialog(member: TeamMember) {
    setMemberToRemove(member)
    setIsRemoveDialogOpen(true)
    setActionMenuOpen(null)
  }

  async function handleConfirmRemoveMember() {
    if (!memberToRemove) return

    setRemovingMember(true)
    const { error } = await removeMember(memberToRemove.id)

    if (error) {
      toast.error(error.message || 'Failed to remove member')
    } else {
      toast.success(`${memberToRemove.full_name || memberToRemove.email || 'Member'} has been removed from the workspace`)
      await fetchMembers()
    }

    setRemovingMember(false)
    setIsRemoveDialogOpen(false)
    setMemberToRemove(null)
  }

  function handleCancelRemove() {
    setIsRemoveDialogOpen(false)
    setMemberToRemove(null)
  }

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Team
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage your workspace team members
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="btn-primary"
          >
            <Plus className="h-5 w-5 mr-2" />
            Invite Member
          </button>
        )}
      </div>

      {/* Team Members Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              {canInvite && (
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {/* Loading State */}
            {loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary-500" />
                  <p className="mt-2 text-sm text-slate-500">Loading team members...</p>
                </td>
              </tr>
            )}

            {/* Active Members */}
            {!loading && members.map((member) => {
              const isCurrentUser = member.user_id === user?.id
              const canModify = canChangeRoles && !isCurrentUser && member.role !== 'owner'

              return (
                <tr
                  key={member.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.full_name || 'User avatar'}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                          {member.full_name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {member.full_name || 'Unnamed'}
                          {isCurrentUser && <span className="ml-2 text-xs text-slate-400">(You)</span>}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      member.role === 'owner'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        : member.role === 'admin'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : member.role === 'member'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      Active
                    </span>
                  </td>
                  {canInvite && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {canModify && (
                        <div className="relative inline-block" ref={actionMenuOpen === member.id ? actionMenuRef : null}>
                          <button
                            onClick={() => setActionMenuOpen(actionMenuOpen === member.id ? null : member.id)}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            {changingRole === member.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-5 w-5" />
                            )}
                          </button>

                          {/* Action Dropdown Menu */}
                          {actionMenuOpen === member.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
                              <div className="py-1">
                                <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase">
                                  Change Role
                                </div>
                                {(['admin', 'member', 'viewer'] as WorkspaceRole[]).map((role) => (
                                  <button
                                    key={role}
                                    onClick={() => handleChangeRole(member.id, role)}
                                    disabled={member.role === role}
                                    className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${
                                      member.role === role
                                        ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                        : 'text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <span className="capitalize">{role}</span>
                                    {member.role === role && (
                                      <span className="text-xs text-primary-500">Current</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="border-t border-slate-200 dark:border-slate-700 py-1">
                                <button
                                  onClick={() => openRemoveDialog(member)}
                                  className="w-full px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center"
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Remove from workspace
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}

            {/* Pending Invitations */}
            {pendingInvitations.map((invitation) => (
              <tr
                key={invitation.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-slate-25 dark:bg-slate-800/25"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 font-medium">
                      {invitation.email[0].toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Pending Invitation
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {invitation.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                    invitation.role === 'admin'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {invitation.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    Invited {formatDate(invitation.invitedAt)}
                  </p>
                </td>
                {canInvite && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => cancelInvitation(invitation.id)}
                      className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                      title="Cancel invitation"
                      aria-label="Cancel invitation"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && members.length === 0 && pendingInvitations.length === 0 && (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No team members yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
              Invite team members to collaborate on clients and projects.
            </p>
            {canInvite && (
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="btn-primary"
              >
                <Plus className="h-5 w-5 mr-2" />
                Invite Your First Team Member
              </button>
            )}
          </div>
        )}
      </div>

      {/* Role Descriptions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Role Permissions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">Owner</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Full access. Can delete workspace and manage billing.
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">Admin</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Can manage team, clients, and projects.
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">Member</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Can create and edit clients and projects.
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">Viewer</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Read-only access to all data.
            </p>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />

      {/* Remove Member Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isRemoveDialogOpen}
        onClose={handleCancelRemove}
        onConfirm={handleConfirmRemoveMember}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${memberToRemove?.full_name || memberToRemove?.email || 'this member'} from the workspace? They will lose access to all workspace data. This action cannot be undone.`}
        confirmText="Remove Member"
        cancelText="Cancel"
        variant="danger"
        loading={removingMember}
      />
    </div>
  )
}

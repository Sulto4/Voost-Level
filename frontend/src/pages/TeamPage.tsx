import { useState } from 'react'
import { Plus, MoreHorizontal, Mail, Shield, Clock, X } from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import { InviteMemberModal } from '../components/team/InviteMemberModal'

export function TeamPage() {
  const { currentWorkspace, currentRole, pendingInvitations, cancelInvitation } = useWorkspace()
  const { profile } = useAuth()
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)

  const canInvite = currentRole === 'owner' || currentRole === 'admin'

  // Current user as the only member for now
  const currentMember = profile ? {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    role: currentRole,
    joined_at: profile.created_at,
  } : null

  const members = currentMember ? [currentMember] : []

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
            {/* Active Members */}
            {members.map((member) => (
              <tr
                key={member.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                      {member.full_name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {member.full_name || 'Unnamed'}
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
                    {member.role !== 'owner' && (
                      <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}

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

        {members.length === 0 && pendingInvitations.length === 0 && (
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
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Role Permissions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Owner</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Full access. Can delete workspace and manage billing.
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Admin</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Can manage team, clients, and projects.
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Member</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Can create and edit clients and projects.
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Viewer</h4>
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
    </div>
  )
}

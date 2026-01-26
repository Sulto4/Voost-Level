import { Plus, MoreHorizontal, Mail, Shield } from 'lucide-react'
import { useWorkspace } from '../context/WorkspaceContext'

export function TeamPage() {
  const { currentWorkspace, currentRole } = useWorkspace()
  const members: any[] = [] // Would come from API

  const canInvite = currentRole === 'owner' || currentRole === 'admin'

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
          <button className="btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Invite Member
          </button>
        )}
      </div>

      {/* Team Members */}
      {members.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            You're the only member
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
            Invite team members to collaborate on clients and projects.
          </p>
          {canInvite && (
            <button className="btn-primary">
              <Plus className="h-5 w-5 mr-2" />
              Invite Your First Team Member
            </button>
          )}
        </div>
      ) : (
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
                  Joined
                </th>
                {canInvite && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
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
                    <span className={`badge-${member.role === 'owner' ? 'primary' : member.role === 'admin' ? 'secondary' : 'warning'}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : 'Pending'}
                  </td>
                  {canInvite && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  )
}

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Workspace, WorkspaceMember, WorkspaceRole } from '../types/database'

interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole
}

interface WorkspaceContextType {
  workspaces: WorkspaceWithRole[]
  currentWorkspace: WorkspaceWithRole | null
  currentRole: WorkspaceRole | null
  loading: boolean
  selectWorkspace: (workspaceId: string) => void
  createWorkspace: (name: string, slug: string) => Promise<{ data: Workspace | null; error: Error | null }>
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<{ error: Error | null }>
  deleteWorkspace: (id: string) => Promise<{ error: Error | null }>
  inviteMember: (email: string, role: WorkspaceRole) => Promise<{ error: Error | null }>
  removeMember: (memberId: string) => Promise<{ error: Error | null }>
  updateMemberRole: (memberId: string, role: WorkspaceRole) => Promise<{ error: Error | null }>
  refreshWorkspaces: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceWithRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchWorkspaces()
    } else {
      setWorkspaces([])
      setCurrentWorkspace(null)
      setLoading(false)
    }
  }, [user])

  async function fetchWorkspaces() {
    if (!user) return

    setLoading(true)
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspace:workspaces(*)
      `)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching workspaces:', error)
      setLoading(false)
      return
    }

    const workspacesWithRoles: WorkspaceWithRole[] = (memberships || [])
      .filter((m) => m.workspace)
      .map((m) => ({
        ...(m.workspace as Workspace),
        role: m.role,
      }))

    setWorkspaces(workspacesWithRoles)

    // Restore last selected workspace or select first
    const lastWorkspaceId = localStorage.getItem('currentWorkspaceId')
    const lastWorkspace = workspacesWithRoles.find((w) => w.id === lastWorkspaceId)

    if (lastWorkspace) {
      setCurrentWorkspace(lastWorkspace)
    } else if (workspacesWithRoles.length > 0) {
      setCurrentWorkspace(workspacesWithRoles[0])
      localStorage.setItem('currentWorkspaceId', workspacesWithRoles[0].id)
    }

    setLoading(false)
  }

  function selectWorkspace(workspaceId: string) {
    const workspace = workspaces.find((w) => w.id === workspaceId)
    if (workspace) {
      setCurrentWorkspace(workspace)
      localStorage.setItem('currentWorkspaceId', workspaceId)
    }
  }

  async function createWorkspace(name: string, slug: string) {
    if (!user) return { data: null, error: new Error('Not authenticated') }

    const { data: workspace, error: createError } = await supabase
      .from('workspaces')
      .insert({
        name,
        slug,
        created_by: user.id,
      })
      .select()
      .single()

    if (createError) {
      return { data: null, error: createError as Error }
    }

    // Add creator as owner
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner',
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      return { data: null, error: memberError as Error }
    }

    await fetchWorkspaces()
    return { data: workspace, error: null }
  }

  async function updateWorkspace(id: string, updates: Partial<Workspace>) {
    const { error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)

    if (!error) {
      await fetchWorkspaces()
    }
    return { error: error as Error | null }
  }

  async function deleteWorkspace(id: string) {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id)

    if (!error) {
      await fetchWorkspaces()
    }
    return { error: error as Error | null }
  }

  async function inviteMember(email: string, role: WorkspaceRole) {
    if (!currentWorkspace || !user) {
      return { error: new Error('No workspace selected') }
    }

    // For now, just create a pending membership
    // In production, this would send an email invitation
    const { error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id, // This would be resolved from email
        role,
        invited_at: new Date().toISOString(),
      })

    return { error: error as Error | null }
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)

    return { error: error as Error | null }
  }

  async function updateMemberRole(memberId: string, role: WorkspaceRole) {
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId)

    return { error: error as Error | null }
  }

  async function refreshWorkspaces() {
    await fetchWorkspaces()
  }

  const value = {
    workspaces,
    currentWorkspace,
    currentRole: currentWorkspace?.role ?? null,
    loading,
    selectWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteMember,
    removeMember,
    updateMemberRole,
    refreshWorkspaces,
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { WorkspaceRole } from '../../types/database'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireWorkspace?: boolean
  allowedRoles?: WorkspaceRole[]
}

// Role hierarchy: owner > admin > member > viewer
const roleHierarchy: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

function hasRequiredRole(currentRole: WorkspaceRole | null, allowedRoles: WorkspaceRole[]): boolean {
  if (!currentRole) return false
  return allowedRoles.some(role => roleHierarchy[currentRole] >= roleHierarchy[role])
}

export function ProtectedRoute({ children, requireWorkspace = true, allowedRoles }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth()
  const { workspaces, currentRole, loading: workspaceLoading } = useWorkspace()
  const location = useLocation()

  if (authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    // Redirect to login but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If user has no workspaces and we're not on the onboarding page, redirect to onboarding
  if (requireWorkspace && workspaces.length === 0 && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  // Check role-based access if allowedRoles is specified
  if (allowedRoles && allowedRoles.length > 0 && !hasRequiredRole(currentRole, allowedRoles)) {
    // Redirect to dashboard with a message that they don't have access
    return <Navigate to="/dashboard" state={{ accessDenied: true }} replace />
  }

  return <>{children}</>
}

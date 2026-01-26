import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireWorkspace?: boolean
}

export function ProtectedRoute({ children, requireWorkspace = true }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth()
  const { workspaces, loading: workspaceLoading } = useWorkspace()
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

  return <>{children}</>
}

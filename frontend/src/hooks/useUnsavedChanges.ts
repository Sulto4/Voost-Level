import { useEffect, useCallback, useState } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Hook to warn users about unsaved changes when navigating away
 *
 * @param isDirty - Boolean indicating if there are unsaved changes
 * @param message - Custom message to show (optional)
 * @returns Object with blocker state and confirm/cancel functions
 */
export function useUnsavedChanges(isDirty: boolean, message?: string) {
  const [showDialog, setShowDialog] = useState(false)

  // Block navigation when form is dirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  )

  // Handle browser refresh/close
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = message || 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, message])

  // Show dialog when blocked
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowDialog(true)
    }
  }, [blocker.state])

  const confirmNavigation = useCallback(() => {
    setShowDialog(false)
    if (blocker.state === 'blocked') {
      blocker.proceed()
    }
  }, [blocker])

  const cancelNavigation = useCallback(() => {
    setShowDialog(false)
    if (blocker.state === 'blocked') {
      blocker.reset()
    }
  }, [blocker])

  return {
    showDialog,
    confirmNavigation,
    cancelNavigation,
    isBlocked: blocker.state === 'blocked',
  }
}

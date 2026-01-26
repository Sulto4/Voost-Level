import { useState, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

// Inactivity timeout in milliseconds (15 minutes)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000
// Warning shown 2 minutes before timeout
const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000

interface InactivityWarningProps {
  onLogout?: () => void
}

export function InactivityWarning({ onLogout }: InactivityWarningProps) {
  const { user, signOut } = useAuth()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_BEFORE_TIMEOUT / 1000)

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    setShowWarning(false)
    setSecondsRemaining(WARNING_BEFORE_TIMEOUT / 1000)
  }, [])

  // Extend session / stay logged in
  const handleStayLoggedIn = useCallback(async () => {
    // Refresh the session to extend it
    await supabase.auth.refreshSession()
    resetTimer()
  }, [resetTimer])

  // Handle logout
  const handleLogout = useCallback(async () => {
    setShowWarning(false)
    await signOut()
    onLogout?.()
  }, [signOut, onLogout])

  useEffect(() => {
    if (!user) return

    let inactivityTimer: NodeJS.Timeout | null = null
    let warningTimer: NodeJS.Timeout | null = null
    let countdownInterval: NodeJS.Timeout | null = null

    // Reset and start the inactivity timer
    const startTimer = () => {
      // Clear existing timers
      if (inactivityTimer) clearTimeout(inactivityTimer)
      if (warningTimer) clearTimeout(warningTimer)
      if (countdownInterval) clearInterval(countdownInterval)

      setShowWarning(false)
      setSecondsRemaining(WARNING_BEFORE_TIMEOUT / 1000)

      // Set timer to show warning before timeout
      warningTimer = setTimeout(() => {
        setShowWarning(true)

        // Start countdown
        let remaining = WARNING_BEFORE_TIMEOUT / 1000
        setSecondsRemaining(remaining)

        countdownInterval = setInterval(() => {
          remaining -= 1
          setSecondsRemaining(remaining)

          if (remaining <= 0) {
            if (countdownInterval) clearInterval(countdownInterval)
            handleLogout()
          }
        }, 1000)
      }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT)
    }

    // Activity event handler
    const handleActivity = () => {
      if (!showWarning) {
        startTimer()
      }
    }

    // Events that indicate user activity
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]

    // Attach event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Start the initial timer
    startTimer()

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (inactivityTimer) clearTimeout(inactivityTimer)
      if (warningTimer) clearTimeout(warningTimer)
      if (countdownInterval) clearInterval(countdownInterval)
    }
  }, [user, showWarning, handleLogout])

  // Format seconds as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!showWarning || !user) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Session Expiring Soon
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You've been inactive for a while
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Your session will expire in{' '}
          <span className="font-bold text-red-600 dark:text-red-400">
            {formatTime(secondsRemaining)}
          </span>{' '}
          due to inactivity. Would you like to stay logged in?
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleLogout}
            className="btn-outline"
          >
            Log Out
          </button>
          <button
            onClick={handleStayLoggedIn}
            className="btn-primary"
            autoFocus
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  )
}

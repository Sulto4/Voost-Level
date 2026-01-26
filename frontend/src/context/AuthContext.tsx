import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let initialCheckDone = false

    // Listen for auth changes - this fires first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] Auth state changed:', event, session ? 'has session' : 'no session')
        if (!mounted) return

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          // Fetch profile in background, don't block loading
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }

        // Set loading false immediately after auth state is known
        if (!initialCheckDone) {
          initialCheckDone = true
          console.log('[AuthContext] Initial auth check done, setting loading=false')
          setLoading(false)
        } else {
          console.log('[AuthContext] Auth change processed, setting loading=false')
          setLoading(false)
        }
      }
    )

    // Get initial session - this triggers onAuthStateChange with INITIAL_SESSION
    console.log('[AuthContext] Getting initial session...')
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] Got session:', session ? 'exists' : 'null')
      // If no auth state change was fired yet (no session), set loading false
      if (!initialCheckDone && !session) {
        initialCheckDone = true
        setLoading(false)
      }
    }).catch((error) => {
      console.error('[AuthContext] Error getting session:', error)
      if (!initialCheckDone) {
        initialCheckDone = true
        setLoading(false)
      }
    })

    // Failsafe timeout - if nothing resolves in 5 seconds, stop loading
    const timeout = setTimeout(() => {
      if (!initialCheckDone && mounted) {
        console.warn('[AuthContext] Timeout reached, forcing loading=false')
        initialCheckDone = true
        setLoading(false)
      }
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function fetchProfile(userId: string) {
    console.log('[AuthContext] Fetching profile for user:', userId)
    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      })

      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>

      console.log('[AuthContext] Profile fetch result:', { data: data ? 'found' : 'null', error })
      if (error) {
        console.error('Error fetching profile:', error)
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('Exception fetching profile:', err)
    }
    console.log('[AuthContext] fetchProfile completed')
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error: error as Error | null }
  }

  async function signUp(email: string, password: string, fullName?: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { error: error as Error | null }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    return { error: error as Error | null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error as Error | null }
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({
      password,
    })
    return { error: error as Error | null }
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return { error: new Error('Not authenticated') }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (!error) {
      setProfile((prev) => (prev ? { ...prev, ...updates } : null))
    }
    return { error: error as Error | null }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

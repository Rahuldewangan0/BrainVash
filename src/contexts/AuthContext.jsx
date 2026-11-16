import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { AuthContext } from './authContextDef'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(isSupabaseConfigured && supabase))
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(
    () => typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  )

  // Fetch profile from the profiles table
  const fetchProfile = async (userId) => {
    if (!supabase || !userId) return null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, college_name, branch, semester, avatar_url, is_admin, total_score, weekly_score, quizzes_attempted, created_at')
        .eq('id', userId)
        .single()
      if (error) {
        console.warn('[BrainVash] Profile fetch error:', error.message)
        return null
      }
      return data
    } catch (err) {
      console.warn('[BrainVash] Profile fetch exception:', err.message)
      return null
    }
  }

  // Initialize auth state on mount
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return
    }

    // Get current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const p = await fetchProfile(currentUser.id)
        setProfile(p)
      }
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecoveryMode(true)
        }

        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          // Small delay to allow the trigger to create the profile on signup
          if (event === 'SIGNED_IN') {
            await new Promise((r) => setTimeout(r, 600))
          }
          let p = await fetchProfile(currentUser.id)

          // If profile branch, semester or college are null but available in user_metadata, sync them
          if (p && (!p.branch || !p.semester || !p.college_name) && (currentUser.user_metadata?.branch || currentUser.user_metadata?.semester || currentUser.user_metadata?.college_name)) {
            try {
              await supabase
                .from('profiles')
                .update({
                  branch: p.branch || currentUser.user_metadata?.branch || null,
                  semester: p.semester || (currentUser.user_metadata?.semester ? parseInt(currentUser.user_metadata.semester, 10) : null),
                  college_name: p.college_name || currentUser.user_metadata?.college_name || null,
                })
                .eq('id', currentUser.id)
              p = await fetchProfile(currentUser.id)
            } catch (syncErr) {
              console.warn('[BrainVash] Profile sync notice:', syncErr.message)
            }
          }

          setProfile(p)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Sign up with email, password and metadata
  const signUp = async ({ email, password, fullName, collegeName, branch, semester }) => {
    if (!supabase) return { error: { message: 'Supabase is not configured.' } }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          college: collegeName,
          branch: branch || null,
          semester: semester ? parseInt(semester, 10) : null,
        },
      },
    })

    if (error) return { data: null, error }

    // If user was created and auto-confirmed, update profile with extra fields
    if (data.user && data.session) {
      await new Promise((r) => setTimeout(r, 800))

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          branch: branch || null,
          semester: semester ? parseInt(semester, 10) : null,
          college_name: collegeName || null,
        })
        .eq('id', data.user.id)

      if (profileError) {
        console.warn('[BrainVash] Profile update after signup:', profileError.message)
      }

      const p = await fetchProfile(data.user.id)
      setProfile(p)
    }

    return { data, error: null }
  }

  // Sign in with email and password
  const signIn = async ({ email, password }) => {
    if (!supabase) return { error: { message: 'Supabase is not configured.' } }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!error && data?.user) {
      const p = await fetchProfile(data.user.id)
      setProfile(p)
    }

    return { data, error }
  }

  // Sign out
  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  // Send password reset email
  const resetPassword = async (email) => {
    if (!supabase) return { error: { message: 'Supabase is not configured.' } }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    })

    return { data, error }
  }

  // Update password (for password reset / recovery)
  const updatePassword = async (newPassword) => {
    if (!supabase) return { error: { message: 'Supabase is not configured.' } }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (!error) {
      setPasswordRecoveryMode(false)
      // Clean up hash from url without reload
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }

    return { data, error }
  }

  // Update student profile (only allowed fields: full_name, college_name, branch, semester)
  const updateProfile = async ({ fullName, collegeName, branch, semester }) => {
    if (!supabase || !user) return { error: { message: 'You must be logged in to update your profile.' } }

    const updates = {}
    if (fullName !== undefined) updates.full_name = fullName.trim()
    if (collegeName !== undefined) updates.college_name = collegeName.trim()
    if (branch !== undefined) updates.branch = branch ? branch.trim() : null
    if (semester !== undefined) updates.semester = semester ? parseInt(semester, 10) : null

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (!error) {
      await refreshProfile()
    }

    return { data, error }
  }

  // Refresh profile data
  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id)
      setProfile(p)
    }
  }

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    passwordRecoveryMode,
    setPasswordRecoveryMode,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider

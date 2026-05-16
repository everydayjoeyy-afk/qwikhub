import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // supabase auth user
  const [profile, setProfile] = useState(null)   // users table row
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async ({ email, password, name, phone, referralCode }) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error || !data.user) return { error }

    // Generate a unique referral code from name
    const genCode = name.toUpperCase().replace(/\s+/g, '').slice(0, 5) +
      Math.random().toString(36).slice(2, 5).toUpperCase()

    // Resolve referred_by user id from referral code
    let referredBy = null
    if (referralCode) {
      const { data: refUser } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', referralCode)
        .single()
      referredBy = refUser?.id ?? null
    }

    // Insert into users table
    const { error: profileError } = await supabase.from('users').insert({
      id:            data.user.id,
      name,
      phone,
      email,
      referral_code: genCode,
      referred_by:   referredBy,
    })

    // If they were referred, create referral record
    if (referredBy) {
      await supabase.from('referrals').insert({
        referrer_id:      referredBy,
        referred_user_id: data.user.id,
        commission_amount: 0,
      })
    }

    return { error: profileError ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signUp, signOut, resetPassword, updatePassword,
      refetchProfile: () => user && fetchProfile(user.id),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

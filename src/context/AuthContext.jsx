import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // supabase auth user
  const [profile, setProfile] = useState(null)   // users table row
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId, authUser = null) {
    // Show name immediately from session metadata (no network call needed)
    if (authUser?.user_metadata?.name) {
      setProfile(prev => prev ?? {
        name:           authUser.user_metadata.name,
        phone:          authUser.user_metadata.phone ?? '',
        wallet_balance: 0,
        referral_code:  null,
      })
    }

    // Then fetch the full profile from the DB and overwrite
    const { data, error } = await supabase
      .from('users').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
    } else {
      if (error) console.error('[fetchProfile]', error.message)
      // Retry once after 3 s (handles race where users row isn't inserted yet)
      setTimeout(async () => {
        const { data: retry } = await supabase
          .from('users').select('*').eq('id', userId).single()
        if (retry) setProfile(retry)
      }, 3000)
    }
  }

  useEffect(() => {
    let loadingCleared = false
    const clearLoadingOnce = () => {
      if (!loadingCleared) { loadingCleared = true; setLoading(false) }
    }

    // ── FAST PATH (synchronous) ──────────────────────────────────────────
    // Read the cached session from localStorage instantly so returning users
    // never see a blank/loading screen while the network token-refresh runs.
    // The user object inside the session is valid even after the access token expires.
    try {
      const raw = localStorage.getItem('sb-qwikhub-session')
      if (raw) {
        const cachedUser = JSON.parse(raw)?.user
        if (cachedUser?.id) {
          setUser(cachedUser)
          fetchProfile(cachedUser.id, cachedUser)
          clearLoadingOnce()   // show the app immediately
        }
      }
    } catch (_) {}

    // Fallback for brand-new users who have nothing in localStorage yet
    const fallback = setTimeout(clearLoadingOnce, 5000)

    // ── SLOW PATH (async) ────────────────────────────────────────────────
    // Proper token validation / refresh.  Corrects state if the cached
    // session turned out to be invalid or was revoked.
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(fallback)
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id, session.user)
      } else {
        // Refresh failed or no session — force sign-out
        setUser(null)
        setProfile(null)
        localStorage.removeItem('sb-qwikhub-session')
      }
      clearLoadingOnce()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id, session.user)
        } else {
          setProfile(null)
        }
      }
    )
    return () => { clearTimeout(fallback); subscription.unsubscribe() }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async ({ email, password, name, phone, referralCode }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim(), phone: phone.trim() } },
    })
    if (error || !data.user) return { error }

    // Generate a unique referral code from name
    const genCode = name.toUpperCase().replace(/\s+/g, '').slice(0, 5) +
      Math.random().toString(36).slice(2, 5).toUpperCase()

    // Resolve referred_by user id from referral code.
    // Uses an RPC (SECURITY DEFINER) because RLS prevents reading other users' rows directly.
    let referredBy = null
    if (referralCode) {
      const { data: refId } = await supabase
        .rpc('get_referrer_id', { p_code: referralCode.trim().toUpperCase() })
      referredBy = refId ?? null
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

  const signOut = () => {
    // Clear state and localStorage immediately so navigation works right away,
    // regardless of how long the network sign-out request takes.
    setUser(null)
    setProfile(null)
    localStorage.removeItem('sb-qwikhub-session')
    // Fire the server-side sign-out in the background (don't block on it)
    supabase.auth.signOut().catch(() => {})
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

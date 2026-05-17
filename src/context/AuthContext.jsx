import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // supabase auth user
  const [profile, setProfile] = useState(null)   // users table row
  const [loading, setLoading] = useState(true)
  // ready = true once supabase.auth.getSession() has resolved, meaning the
  // Supabase client's internal initialization lock is released and supabase.rpc()
  // / supabase.from() calls can proceed without deadlocking.
  const [ready, setReady]     = useState(false)

  async function fetchProfile(userId, _authUser = null) {
    // ── Optimistic fast path: show name/phone from session metadata immediately ──
    // wallet_balance is intentionally NOT set here — we never want to flash ₵0.00
    // while the real balance hasn't arrived yet.
    if (_authUser?.user_metadata?.name) {
      setProfile(prev => prev ?? {
        name:           _authUser.user_metadata.name,
        phone:          _authUser.user_metadata.phone ?? '',
        referral_code:  null,
      })
    }

    // ── Direct REST query — bypasses supabase.from() ──────────────────────────
    // supabase.from() internally calls auth.getSession(), which awaits the
    // Supabase client's initialization lock. That lock is held during the
    // INITIAL_SESSION notification that calls fetchProfile — creating a deadlock
    // where the DB query can never fire. Using a plain fetch avoids the lock
    // entirely while still using the same credentials.
    const sessionRaw = localStorage.getItem('sb-qwikhub-session')
    let accessToken = sessionRaw ? (JSON.parse(sessionRaw)?.access_token ?? null) : null

    if (!accessToken) {
      console.warn('[fetchProfile] no access token available')
      return
    }

    const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
    const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY

    const query = async (token) =>
      fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=*`, {
        headers: {
          apikey:          ANON_KEY,
          Authorization:   `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
      })

    let res = await query(accessToken)

    // If 401, the access token expired — refresh and retry once
    if (res.status === 401) {
      const { data: refreshData } = await supabase.auth.refreshSession()
      if (refreshData?.session) {
        setUser(refreshData.session.user)
        accessToken = refreshData.session.access_token
        res = await query(accessToken)
      } else {
        setUser(null)
        setProfile(null)
        localStorage.removeItem('sb-qwikhub-session')
        return
      }
    }

    if (!res.ok) {
      console.error('[fetchProfile] query failed', res.status)
      // Retry once after 3 s (handles sign-up race where row isn't inserted yet)
      setTimeout(async () => {
        const r = await query(accessToken).catch(() => null)
        if (!r?.ok) return
        const rows = await r.json()
        if (rows?.[0]) setProfile(rows[0])
      }, 3000)
      return
    }

    const rows = await res.json()
    if (rows?.[0]) {
      setProfile(rows[0])
    } else {
      console.warn('[fetchProfile] no row found for user', userId)
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
      // Belt-and-suspenders: set ready here too.
      // getSession() now resolves (no longer deadlocked) because fetchProfile
      // uses direct REST instead of supabase.from(), so the init lock is released.
      setReady(true)
      clearLoadingOnce()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // ⚠️ Must NOT be async — Supabase v2 awaits all onAuthStateChange callbacks
        // before resolving token operations. An async callback that calls
        // supabase.from() creates a deadlock: the DB query waits for the
        // refresh lock to release, but the lock waits for this callback to finish.
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id, session.user) // fire-and-forget — intentional
        } else {
          setProfile(null)
        }
        setReady(true)
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

    // ── All DB calls below use direct REST to avoid the Supabase init-lock deadlock ──
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY
    // At sign-up the user has no access token yet — use the anon key as bearer
    const restHeaders  = {
      apikey:         ANON_KEY,
      Authorization:  `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=representation',
    }

    // Resolve referred_by user id from referral code via direct REST RPC
    let referredBy = null
    if (referralCode) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_referrer_id`, {
          method:  'POST',
          headers: restHeaders,
          body:    JSON.stringify({ p_code: referralCode.trim().toUpperCase() }),
        })
        if (res.ok) {
          const refId = await res.json()
          referredBy = refId ?? null
        }
      } catch (_) { /* non-fatal — sign up without referral link */ }
    }

    // Insert into users table
    const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method:  'POST',
      headers: restHeaders,
      body:    JSON.stringify({ id: data.user.id, name, phone, email, referral_code: genCode, referred_by: referredBy }),
    })
    const profileError = usersRes.ok ? null : { message: `Profile insert failed (${usersRes.status})` }

    // If they were referred, create referral record
    if (referredBy) {
      await fetch(`${SUPABASE_URL}/rest/v1/referrals`, {
        method:  'POST',
        headers: restHeaders,
        body:    JSON.stringify({ referrer_id: referredBy, referred_user_id: data.user.id, commission_amount: 0 }),
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
      user, profile, loading, ready,
      signIn, signUp, signOut, resetPassword, updatePassword,
      refetchProfile: () => {
      if (!user) return Promise.resolve()
      // Call fetchProfile directly — autoRefreshToken handles expiry in the background.
      // Do NOT call supabase.auth.refreshSession() here: it fires onAuthStateChange
      // (TOKEN_REFRESHED) which would call fetchProfile a second time in parallel.
      return fetchProfile(user.id, user)
    },
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

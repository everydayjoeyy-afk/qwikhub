/**
 * Database helper functions — thin wrappers around Supabase queries.
 * Import what you need per-page rather than querying directly.
 */
import { supabase } from './supabase'

// ── Direct REST helper ────────────────────────────────────────
// Bypasses the Supabase JS client's initialization lock so these calls
// can fire safely during app startup (same technique as fetchProfile).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getAccessToken() {
  try {
    const raw = localStorage.getItem('sb-qwikhub-session')
    if (!raw) return null
    const session = JSON.parse(raw)
    const token = session?.access_token
    if (!token) return null

    // Check expiry — refresh proactively if within 60 s of expiry
    const payload = JSON.parse(atob(token.split('.')[1]))
    const isExpired = Date.now() > payload.exp * 1000 - 60_000

    if (!isExpired) return token

    // Token expired: exchange refresh_token for a new session via direct REST
    const refreshToken = session?.refresh_token
    if (!refreshToken) return null

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method:  'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null

    const newSession = await res.json()
    if (!newSession?.access_token) return null

    // Persist the refreshed session so subsequent calls use it too
    localStorage.setItem('sb-qwikhub-session', JSON.stringify(newSession))
    return newSession.access_token
  } catch { return null }
}

async function restFetch(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken()
  if (!token) return { data: null, error: { message: 'No access token' } }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey:         ANON_KEY,
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer:         'return=representation',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { data: null, error: { message: text || `HTTP ${res.status}` } }
  }
  // Some endpoints (void RPCs, 204s) return an empty body — guard against that
  const text = await res.text().catch(() => '')
  if (!text) return { data: null, error: null }
  try {
    return { data: JSON.parse(text), error: null }
  } catch {
    return { data: null, error: { message: 'Invalid JSON response' } }
  }
}

// ── Auth helpers ─────────────────────────────────────────────
/**
 * Check if an email exists in the users table.
 * Uses the anon key only (no auth token) — safe to call from the
 * Forgot Password page where the user is not yet signed in.
 */
export async function checkEmailExists(email) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email.trim())}&select=id&limit=1`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    )
    // If the column doesn't exist (400) or any server error, skip the pre-check
    // and let Supabase's resetPasswordForEmail handle it (it always returns success
    // for unknown emails which is secure, but better than blocking everyone).
    if (!res.ok) return { exists: true, error: null }
    const data = await res.json()
    return { exists: Array.isArray(data) && data.length > 0, error: null }
  } catch {
    return { exists: true, error: null }
  }
}

// ── Store ────────────────────────────────────────────────────
export async function getMyStore(userId) {
  // Direct REST — bypasses init lock so Store/Refer pages load on first render
  const { data, error } = await restFetch(`stores?user_id=eq.${userId}&select=*`)
  // REST returns an array; return first row (or null if none)
  return { data: Array.isArray(data) ? (data[0] ?? null) : null, error }
}

export async function getStoreBySlug(slug) {
  const { data, error } = await restFetch(
    `stores?store_slug=eq.${encodeURIComponent(slug)}&select=*`
  )
  return { data: Array.isArray(data) ? (data[0] ?? null) : null, error }
}

export async function createStore(userId, { store_name, store_slug, theme }) {
  const { data, error } = await restFetch('stores', {
    method: 'POST',
    body: { user_id: userId, store_name, store_slug, theme },
  })
  return { data: Array.isArray(data) ? (data[0] ?? null) : data, error }
}

export async function updateStore(storeId, { store_name, store_slug, theme }) {
  const { data, error } = await restFetch(
    `stores?id=eq.${storeId}`,
    { method: 'PATCH', body: { store_name, store_slug, theme } }
  )
  return { data: Array.isArray(data) ? (data[0] ?? null) : null, error }
}

// ── Store bundles (reseller prices) ─────────────────────────
export async function getStoreBundles(storeId) {
  // Direct REST with PostgREST embed syntax for the bundle join
  const { data, error } = await restFetch(
    `store_bundles?store_id=eq.${storeId}&is_active=eq.true&select=*,bundle:bundles(*)`
  )
  return { data: data ?? [], error }
}

export async function upsertStoreBundle(storeId, bundleId, customPrice) {
  // Prefer: resolution=merge-duplicates triggers ON CONFLICT DO UPDATE
  const token = await getAccessToken()
  if (!token) return { error: { message: 'No access token' } }
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/store_bundles`,
    {
      method: 'POST',
      headers: {
        apikey:         import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer:         'resolution=merge-duplicates',
      },
      body: JSON.stringify({ store_id: storeId, bundle_id: bundleId, custom_price: customPrice, is_active: true }),
    }
  )
  return { error: res.ok ? null : { message: `HTTP ${res.status}` } }
}

// ── Orders ───────────────────────────────────────────────────
export async function getStoreOrders(storeId) {
  const { data, error } = await restFetch(
    `orders?store_id=eq.${storeId}&select=*,bundle:bundles(carrier,data_size)&order=created_at.desc`
  )
  return { data: data ?? [], error }
}

export async function createOrder({ buyerPhone, bundleId, storeId, amountPaid, profit, paystackRef }) {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      buyer_phone:    buyerPhone,
      bundle_id:      bundleId,
      store_id:       storeId,
      amount_paid:    amountPaid,
      profit,
      paystack_ref:   paystackRef,
      status:         'paid',
    })
    .select()
    .single()
  return { data, error }
}

// ── Wallet ───────────────────────────────────────────────────
// creditWallet: credits the deposit wallet_balance (top-ups only)
export async function creditWallet(userId, amount, description, reference = null) {
  const { data, error } = await restFetch('rpc/credit_wallet', {
    method: 'POST',
    body: {
      p_user_id:     userId,
      p_amount:      amount,
      p_description: description,
      p_reference:   reference,
    },
  })
  return { data, error }
}

// creditEarnings: credits the withdrawable earnings_balance (store profits, referral transfers)
export async function creditEarnings(userId, amount, description, reference = null) {
  const { data, error } = await restFetch('rpc/credit_earnings', {
    method: 'POST',
    body: {
      p_user_id:     userId,
      p_amount:      amount,
      p_description: description,
      p_reference:   reference,
    },
  })
  return { data, error }
}

// recordReferralCommission: credits 5% of purchase to the buyer's referrer (if any)
export async function recordReferralCommission(buyerUserId, amountPaid) {
  const { data, error } = await restFetch('rpc/record_referral_commission', {
    method: 'POST',
    body: { p_buyer_user_id: buyerUserId, p_amount_paid: amountPaid },
  })
  return { data, error }
}

// transferReferralEarnings: moves available commissions → earnings_balance
// availableReferrals : all referral rows (used to find rows with new commission)
// amount             : pre-calculated sum of available commissions
export async function transferReferralEarnings(userId, availableReferrals, amount) {
  if (amount <= 0) return { data: null, error: null }

  // Rows that have new commission since last transfer
  const rowsToProcess = availableReferrals.filter(
    r => (r.commission_amount ?? 0) > (r.transferredAmount ?? 0)
  )

  // 1. Reset transferred = false so the SECURITY DEFINER RPC can find and
  //    process these rows (the RPC uses WHERE transferred = false).
  //    Rows with transferred = true (prior transfer) but new commission need
  //    this reset or the RPC will skip them.
  if (rowsToProcess.length > 0) {
    await Promise.all(
      rowsToProcess.map(r =>
        restFetch(`referrals?id=eq.${r.id}`, {
          method: 'PATCH',
          body: { transferred: false },
        })
      )
    )
  }

  // 2. Call the SECURITY DEFINER RPC — atomically updates earnings_balance
  //    and records a transaction. Cannot do this from REST directly (RLS blocks
  //    direct writes to earnings_balance on profiles).
  const { data, error } = await restFetch('rpc/transfer_referral_earnings', {
    method: 'POST',
    body: { p_user_id: userId },
  })
  if (error) return { data, error }

  // 3. Stamp transferred_amount = commission_amount so the next incremental
  //    commission from the same user is correctly detected as available.
  if (rowsToProcess.length > 0) {
    await Promise.all(
      rowsToProcess.map(r =>
        restFetch(`referrals?id=eq.${r.id}`, {
          method: 'PATCH',
          body: { transferred_amount: r.commission_amount, transferred: true },
        })
      )
    )
  }

  return { data: null, error: null }
}

// ── Transactions ─────────────────────────────────────────────
export async function getTransactions(userId) {
  // Direct REST — bypasses Supabase client init lock
  const { data, error } = await restFetch(
    `transactions?user_id=eq.${userId}&select=*&order=created_at.desc`
  )
  return { data: data ?? [], error }
}

// ── Withdrawals ──────────────────────────────────────────────
export async function getWithdrawals(userId) {
  // Direct REST — bypasses Supabase client init lock
  const { data, error } = await restFetch(
    `withdrawals?user_id=eq.${userId}&select=*&order=created_at.desc`
  )
  return { data: data ?? [], error }
}

export async function requestWithdrawal(userId, amount, momoNumber) {
  if (amount < 50) return { error: { message: 'Minimum withdrawal is ₵50' } }

  // Deduct from earnings_balance (not wallet_balance — deposits are not withdrawable)
  const { error: balErr } = await restFetch('rpc/decrement_earnings', {
    method: 'POST',
    body: { p_user_id: userId, p_amount: amount },
  })
  if (balErr) return { error: balErr }

  // Create withdrawal record
  const { data, error } = await restFetch('withdrawals', {
    method: 'POST',
    body: { user_id: userId, amount, momo_number: momoNumber, status: 'pending' },
  })

  // Record debit transaction
  if (!error) {
    await restFetch('transactions', {
      method: 'POST',
      body: { user_id: userId, type: 'debit', amount, description: 'Withdrawal request' },
    })
  }

  return { data: Array.isArray(data) ? (data[0] ?? null) : data, error }
}

// ── Referrals ────────────────────────────────────────────────
export async function getReferrals(userId) {
  // ── Primary path: SECURITY DEFINER RPC (returns user name + phone) ──
  // Run both in parallel: RPC for name/phone, direct table for transferred flag
  // (get_my_referrals may not expose the transferred column, so we read it separately)
  const [{ data: rpcData, error: rpcError }, { data: flagRows }] = await Promise.all([
    restFetch('rpc/get_my_referrals', { method: 'POST', body: { p_user_id: userId } }),
    restFetch(`referrals?referrer_id=eq.${userId}&select=id,transferred,transferred_amount&order=created_at.desc`),
  ])

  if (!rpcError && Array.isArray(rpcData)) {
    // Build a fast lookup: referral id → { transferred, transferred_amount }
    const flagMap = {}
    if (Array.isArray(flagRows)) {
      flagRows.forEach(r => { flagMap[r.id] = r })
    }
    return {
      data: rpcData.map(r => ({
        id:                r.id,
        referred_user_id:  r.referred_user_id,
        commission_amount: r.commission_amount,
        transferred:       flagMap[r.id]?.transferred ?? r.transferred ?? false,
        transferredAmount: flagMap[r.id]?.transferred_amount ?? 0,
        created_at:        r.created_at,
        referred_user: r.user_name ? { name: r.user_name, phone: r.user_phone } : null,
      })),
      error: null,
    }
  }

  // ── Fallback: direct table query ─────────────────────────────────────
  // Used when get_my_referrals RPC hasn't been created in Supabase yet.
  // RLS policy "referrals_own" (referrer_id = auth.uid()) allows this read.
  // User name/phone won't be available here (blocked by RLS on users table).
  console.warn('[getReferrals] RPC unavailable, falling back to table query', rpcError)
  const { data: rows, error: fallbackError } = await restFetch(
    `referrals?referrer_id=eq.${userId}&select=id,referred_user_id,commission_amount,transferred,transferred_amount,created_at&order=created_at.desc`
  )
  if (fallbackError) {
    console.error('[getReferrals] fallback also failed', fallbackError)
    return { data: [], error: fallbackError }
  }
  return {
    data: (rows ?? []).map(r => ({
      id:                r.id,
      referred_user_id:  r.referred_user_id,
      commission_amount: r.commission_amount,
      transferred:       r.transferred ?? false,
      transferredAmount: r.transferred_amount ?? 0,
      created_at:        r.created_at,
      referred_user:     null,
    })),
    error: null,
  }
}

// ── Master bundles ───────────────────────────────────────────
export async function getBundles(carrier = null) {
  const path = carrier
    ? `bundles?is_active=eq.true&carrier=eq.${encodeURIComponent(carrier)}&select=*&order=platform_price.asc`
    : `bundles?is_active=eq.true&select=*&order=platform_price.asc`
  const { data, error } = await restFetch(path)
  return { data: data ?? [], error }
}

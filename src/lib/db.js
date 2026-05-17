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

function getAccessToken() {
  try {
    const raw = localStorage.getItem('sb-qwikhub-session')
    return raw ? (JSON.parse(raw)?.access_token ?? null) : null
  } catch { return null }
}

async function restFetch(path, { method = 'GET', body } = {}) {
  const token = getAccessToken()
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
  const data = await res.json()
  return { data, error: null }
}

// ── Store ────────────────────────────────────────────────────
export async function getMyStore(userId) {
  // Direct REST — bypasses init lock so Store/Refer pages load on first render
  const { data, error } = await restFetch(`stores?user_id=eq.${userId}&select=*`)
  // REST returns an array; return first row (or null if none)
  return { data: Array.isArray(data) ? (data[0] ?? null) : null, error }
}

export async function getStoreBySlug(slug) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('store_slug', slug)
    .single()
  return { data, error }
}

export async function createStore(userId, { store_name, store_slug, theme }) {
  const { data, error } = await supabase
    .from('stores')
    .insert({ user_id: userId, store_name, store_slug, theme })
    .select()
    .single()
  return { data, error }
}

export async function updateStore(storeId, { store_name, store_slug, theme }) {
  const { data, error } = await supabase
    .from('stores')
    .update({ store_name, store_slug, theme })
    .eq('id', storeId)
    .select()
    .single()
  return { data, error }
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
  const { error } = await supabase
    .from('store_bundles')
    .upsert(
      { store_id: storeId, bundle_id: bundleId, custom_price: customPrice, is_active: true },
      { onConflict: 'store_id,bundle_id' }
    )
  return { error }
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
// Uses a SECURITY DEFINER RPC so it works from unauthenticated storefront context
export async function creditWallet(userId, amount, description, reference = null) {
  const { error } = await supabase.rpc('credit_wallet', {
    p_user_id:     userId,
    p_amount:      amount,
    p_description: description,
    p_reference:   reference,
  })
  return { error }
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

  // Deduct from wallet optimistically
  const { error: balErr } = await supabase.rpc('decrement_wallet', {
    p_user_id: userId,
    p_amount:  amount,
  })
  if (balErr) return { error: balErr }

  // Create withdrawal record
  const { data, error } = await supabase
    .from('withdrawals')
    .insert({ user_id: userId, amount, momo_number: momoNumber, status: 'pending' })
    .select()
    .single()

  // Record debit transaction
  if (!error) {
    await supabase.from('transactions').insert({
      user_id:     userId,
      type:        'debit',
      amount,
      description: 'Withdrawal request',
    })
  }

  return { data, error }
}

// ── Referrals ────────────────────────────────────────────────
export async function getReferrals(userId) {
  // ── Primary path: SECURITY DEFINER RPC (returns user name + phone) ──
  // Uses direct REST POST to bypass the Supabase client init lock.
  const { data: rpcData, error: rpcError } = await restFetch('rpc/get_my_referrals', {
    method: 'POST',
    body:   { p_user_id: userId },
  })

  if (!rpcError && Array.isArray(rpcData)) {
    return {
      data: rpcData.map(r => ({
        id:                r.id,
        referred_user_id:  r.referred_user_id,
        commission_amount: r.commission_amount,
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
    `referrals?referrer_id=eq.${userId}&select=id,referred_user_id,commission_amount,created_at&order=created_at.desc`
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
      created_at:        r.created_at,
      referred_user:     null,   // names unavailable without RPC
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

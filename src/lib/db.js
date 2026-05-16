/**
 * Database helper functions — thin wrappers around Supabase queries.
 * Import what you need per-page rather than querying directly.
 */
import { supabase } from './supabase'

// ── Store ────────────────────────────────────────────────────
export async function getMyStore(userId) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
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
  const { data, error } = await supabase
    .from('store_bundles')
    .select('*, bundle:bundles(*)')
    .eq('store_id', storeId)
    .eq('is_active', true)
  return { data, error }
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
  const { data, error } = await supabase
    .from('orders')
    .select('*, bundle:bundles(carrier,data_size)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  return { data, error }
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
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// ── Withdrawals ──────────────────────────────────────────────
export async function getWithdrawals(userId) {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data, error }
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
  // Uses a SECURITY DEFINER RPC because RLS blocks reading referred users' rows directly
  const { data, error } = await supabase
    .rpc('get_my_referrals', { p_user_id: userId })
  // Normalise shape to match what Refer.jsx expects
  const normalised = (data ?? []).map(r => ({
    id:               r.id,
    referred_user_id: r.referred_user_id,
    commission_amount: r.commission_amount,
    created_at:       r.created_at,
    referred_user: r.user_name ? { name: r.user_name, phone: r.user_phone } : null,
  }))
  return { data: normalised, error }
}

// ── Master bundles ───────────────────────────────────────────
export async function getBundles(carrier = null) {
  let q = supabase.from('bundles').select('*').eq('is_active', true).order('platform_price')
  if (carrier) q = q.eq('carrier', carrier)
  const { data, error } = await q
  return { data, error }
}

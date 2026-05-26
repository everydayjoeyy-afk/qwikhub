/**
 * Admin-only database helpers.
 * All functions call SECURITY DEFINER RPCs that verify is_admin server-side.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

async function adminFetch(path, { method = 'GET', body } = {}) {
  const raw   = localStorage.getItem('sb-qwikhub-session')
  const token = raw ? (JSON.parse(raw)?.access_token ?? null) : null
  if (!token) return { data: null, error: { message: 'Not authenticated' } }

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

  const text = await res.text().catch(() => '')
  if (!res.ok) return { data: null, error: { message: text || `HTTP ${res.status}` } }
  if (!text)   return { data: null, error: null }
  try {
    return { data: JSON.parse(text), error: null }
  } catch {
    return { data: null, error: { message: 'Invalid JSON response' } }
  }
}

/** Returns all withdrawals with user name + phone, pending ones first. */
export async function adminGetWithdrawals() {
  return adminFetch('rpc/admin_get_withdrawals', { method: 'POST', body: {} })
}

/** Marks a pending withdrawal as completed (you've sent the MoMo). */
export async function adminApproveWithdrawal(id) {
  return adminFetch('rpc/admin_approve_withdrawal', {
    method: 'POST',
    body: { p_withdrawal_id: id },
  })
}

/** Marks a pending withdrawal as rejected and refunds the earnings balance. */
export async function adminRejectWithdrawal(id) {
  return adminFetch('rpc/admin_reject_withdrawal', {
    method: 'POST',
    body: { p_withdrawal_id: id },
  })
}

/**
 * Returns all orders (storefront + wallet) combined, newest first.
 * p_limit defaults to 300 on the server side.
 */
export async function adminGetOrders() {
  return adminFetch('rpc/admin_get_orders', { method: 'POST', body: {} })
}

/**
 * Search users by name, phone, or email.
 * Empty query returns the 30 most recently joined users.
 */
export async function adminSearchUsers(query = '') {
  return adminFetch('rpc/admin_search_users', {
    method: 'POST',
    body: { p_query: query.trim() },
  })
}

/** Returns the last 15 transactions for a given user. */
export async function adminGetUserTransactions(userId) {
  return adminFetch('rpc/admin_get_user_transactions', {
    method: 'POST',
    body: { p_user_id: userId },
  })
}

/** Returns a single-row snapshot of all platform KPIs. */
export async function adminGetDashboard() {
  return adminFetch('rpc/admin_get_dashboard', { method: 'POST', body: {} })
}

/** Returns daily revenue + order count for the last p_days days. */
export async function adminGetRevenueTrend(days = 7) {
  return adminFetch('rpc/admin_get_revenue_trend', {
    method: 'POST',
    body: { p_days: days },
  })
}

/** Returns platform-wide transactions with user info, newest first. */
export async function adminGetTransactions(limit = 500) {
  return adminFetch('rpc/admin_get_transactions', {
    method: 'POST',
    body: { p_limit: limit },
  })
}

/** Returns wallet top-up credits with user info, newest first. */
export async function adminGetTopups(limit = 300) {
  return adminFetch('rpc/admin_get_topups', {
    method: 'POST',
    body: { p_limit: limit },
  })
}

/**
 * Permanently deletes a user (auth.users + cascade).
 * Cannot delete yourself.
 */
export async function adminDeleteUser(userId) {
  return adminFetch('rpc/admin_delete_user', {
    method: 'POST',
    body: { p_user_id: userId },
  })
}

/**
 * Returns storefront orders with status = 'failed' or 'pending', newest first.
 * Requires the admin_get_failed_orders RPC in Supabase.
 */
export async function adminGetFailedOrders() {
  return adminFetch('rpc/admin_get_failed_orders', { method: 'POST', body: {} })
}

/** Admin: update delivery_status on a transaction (for manual overrides). */
export async function adminUpdateDeliveryStatus(transactionId, newStatus) {
  return adminFetch('rpc/admin_update_delivery_status', {
    method: 'POST',
    body: { p_transaction_id: transactionId, p_status: newStatus },
  })
}

/** Returns subscription orders ([Sub] prefix), newest first. */
export async function adminGetSubscriptionOrders(limit = 300) {
  return adminFetch('rpc/admin_get_subscription_orders', {
    method: 'POST',
    body: { p_limit: limit },
  })
}

/** Admin: update delivery_status on a subscription order. */
export async function adminUpdateSubStatus(transactionId, newStatus) {
  return adminFetch('rpc/admin_update_delivery_status', {
    method: 'POST',
    body: { p_transaction_id: transactionId, p_status: newStatus },
  })
}

/** Returns all bundles (active + inactive) with per-bundle store_bundle count. */
export async function adminGetBundles() {
  return adminFetch('rpc/admin_get_bundles', { method: 'POST', body: {} })
}

/** Returns platform-wide store stats (total_stores, orders_today, revenue_today, total_revenue). */
export async function adminGetStoreOverview() {
  return adminFetch('rpc/admin_get_store_overview', { method: 'POST', body: {} })
}

/**
 * Update a bundle's platform price, cost price, and/or active status.
 * Pass only the fields you want to change.
 */
export async function adminUpdateBundle(bundleId, { platform_price, is_active, cost_price } = {}) {
  const body = { p_bundle_id: bundleId }
  if (platform_price !== undefined) body.p_platform_price = platform_price
  if (is_active      !== undefined) body.p_is_active      = is_active
  if (cost_price     !== undefined) body.p_cost_price     = cost_price
  return adminFetch('rpc/admin_update_bundle', { method: 'POST', body })
}

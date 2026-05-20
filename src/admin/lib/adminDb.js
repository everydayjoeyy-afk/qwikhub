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

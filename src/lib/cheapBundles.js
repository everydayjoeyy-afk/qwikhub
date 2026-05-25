/**
 * Client helpers for the buy-bundle Edge Function.
 * The API key never touches the frontend — it lives in Supabase secrets.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

async function callEdgeFunction(body) {
  const raw   = localStorage.getItem('sb-qwikhub-session')
  const token = raw ? (JSON.parse(raw)?.access_token ?? null) : null

  const headers = {
    apikey:         ANON_KEY,
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res  = await fetch(`${SUPABASE_URL}/functions/v1/buy-bundle`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  return data
}

/**
 * Deliver a bundle purchased via the wallet (CartModal).
 * @param {string} transactionId  - UUID of the transactions row
 * @param {string} phone          - recipient Ghana phone number
 * @param {string} networkId      - 'mtn' | 'telecel' | 'tigo' | 'airteltigo'
 * @param {string} bundleValue    - e.g. '5gb'
 */
export async function deliverWalletBundle({ transactionId, phone, networkId, bundleValue }) {
  return callEdgeFunction({
    action:         'buy',
    transaction_id: transactionId,
    phone,
    network_id:     networkId,
    bundle_value:   bundleValue,
  })
}

/**
 * Deliver a bundle purchased via the storefront (Paystack).
 * @param {string} paystackRef - Paystack payment reference
 * @param {string} buyerPhone  - recipient Ghana phone number
 * @param {string} bundleId    - UUID of the bundles row
 * @param {string} networkId   - 'mtn' | 'telecel' | 'airteltigo'
 * @param {string} bundleValue - e.g. '5gb'
 */
export async function deliverStorefrontBundle({ paystackRef, buyerPhone, bundleId, networkId, bundleValue }) {
  return callEdgeFunction({
    action:       'buy',
    paystack_ref: paystackRef,
    buyer_phone:  buyerPhone,
    bundle_id:    bundleId,
    phone:        buyerPhone,
    network_id:   networkId,
    bundle_value: bundleValue,
  })
}

/**
 * Fetch all packages from the Cheap Bundles API.
 * Use this from the admin panel to verify the correct network IDs,
 * then update NETWORK_IDS in supabase/functions/buy-bundle/index.ts.
 */
export async function getAvailablePackages() {
  return callEdgeFunction({ action: 'packages' })
}

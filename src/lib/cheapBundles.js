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

// NOTE: Storefront delivery is now handled inside the complete-store-order
// edge function (after server-side Paystack verification). The old
// deliverStorefrontBundle helper and the buy-bundle storefront branch it
// called were removed to close an unauthenticated delivery bypass.

/**
 * Fetch all packages from the Cheap Bundles API.
 * Use this from the admin panel to verify the correct network IDs,
 * then update NETWORK_IDS in supabase/functions/buy-bundle/index.ts.
 */
export async function getAvailablePackages() {
  return callEdgeFunction({ action: 'packages' })
}

/**
 * Complete a storefront purchase server-side after Paystack payment.
 * The edge function verifies the payment with Paystack, then atomically
 * creates the order(s), delivers the bundle(s), and credits the seller.
 * Called by unauthenticated storefront customers — no auth token sent.
 *
 * @param {object} opts
 * @param {string} opts.reference - Paystack payment reference
 * @param {string} opts.storeId   - UUID of the store
 * @param {Array<{buyerPhone:string,bundleId:string,networkId:string,bundleValue:string}>} opts.items
 * @returns {Promise<{success:boolean, deliveries?:Array, alreadyProcessed?:boolean, error?:string}>}
 */
export async function completeStoreOrder({ reference, storeId, items }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-store-order`, {
    method:  'POST',
    headers: {
      apikey:         ANON_KEY,
      // Anon key is a valid JWT, so this passes the function's JWT check
      // even when "Verify JWT" is left on — no dashboard toggle needed.
      Authorization:  `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body:    JSON.stringify({ reference, store_id: storeId, items }),
  })
  return res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }))
}

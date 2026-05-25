import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CHEAP_BUNDLES_BASE = 'https://cheap-bundles-ghana.azurewebsites.net/api/external/packages'
const API_KEY            = Deno.env.get('CHEAP_BUNDLES_API_KEY') ?? ''
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')              ?? ''
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// -----------------------------------------------------------------
// Network ID map — update these values after running action:'packages'
// to see the real IDs returned by /all-packages.
// -----------------------------------------------------------------
const NETWORK_IDS: Record<string, number> = {
  mtn:        3,  // MTN Ghana
  telecel:    2,  // Telecel Ghana
  airteltigo: 1,  // AirtelTigo (AT - iShare)
  tigo:       1,  // alias used by the Bundles page (same as airteltigo)
}

function parseGb(bundleValue: string): number {
  const m = bundleValue.match(/^(\d+(?:\.\d+)?)\s*gb$/i)
  return m ? parseFloat(m[1]) : 0
}

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const { action } = body

    // ── action: packages ─────────────────────────────────────────
    // Returns all packages from the Cheap Bundles API so you can
    // verify the correct network_id integers and update NETWORK_IDS.
    if (action === 'packages') {
      const res  = await fetch(`${CHEAP_BUNDLES_BASE}/all-packages`, {
        headers: { 'X-API-KEY': API_KEY },
      })
      const data = await res.json()
      return json({ success: true, packages: data })
    }

    // ── action: buy ───────────────────────────────────────────────
    if (action === 'buy') {
      const { phone, network_id, bundle_value, transaction_id, paystack_ref, buyer_phone, bundle_id } = body

      const networkNum = NETWORK_IDS[network_id]
      if (!networkNum) return json({ success: false, error: `Unknown network: ${network_id}` }, 400)

      const sharedBundle = parseGb(bundle_value)
      if (!sharedBundle) return json({ success: false, error: `Cannot parse bundle size: ${bundle_value}` }, 400)

      const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

      // --- Verify the request is legitimate and not a replay ---
      if (transaction_id) {
        // Wallet purchase: transaction must exist and not already delivered
        const { data: tx, error } = await db
          .from('transactions')
          .select('id, delivery_status')
          .eq('id', transaction_id)
          .single()

        if (error || !tx)                    return json({ success: false, error: 'Transaction not found' }, 404)
        if (tx.delivery_status === 'delivered') return json({ success: false, error: 'Already delivered' }, 409)

      } else if (paystack_ref && buyer_phone && bundle_id) {
        // Storefront purchase: find the order row
        const { data: order, error } = await db
          .from('orders')
          .select('id, delivery_status')
          .eq('paystack_ref', paystack_ref)
          .eq('buyer_phone',  buyer_phone)
          .eq('bundle_id',    bundle_id)
          .maybeSingle()

        if (error || !order)                       return json({ success: false, error: 'Order not found' }, 404)
        if (order.delivery_status === 'delivered') return json({ success: false, error: 'Already delivered' }, 409)

      } else {
        return json({ success: false, error: 'Missing transaction_id or paystack_ref+buyer_phone+bundle_id' }, 400)
      }

      // --- Call the Cheap Bundles API ---
      const apiRes  = await fetch(`${CHEAP_BUNDLES_BASE}/buy-other`, {
        method:  'POST',
        headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          recipient_msisdn: phone,
          network_id:       networkNum,
          shared_bundle:    sharedBundle,
        }),
      })
      const apiData = await apiRes.json()

      if (apiData.success) {
        // Mark delivered and store the transaction code for reconciliation
        if (transaction_id) {
          await db.from('transactions').update({
            delivery_status:  'delivered',
            transaction_code: apiData.transaction_code ?? null,
            delivery_error:   null,
          }).eq('id', transaction_id)
        } else {
          await db.from('orders').update({
            delivery_status:  'delivered',
            transaction_code: apiData.transaction_code ?? null,
          }).eq('paystack_ref', paystack_ref).eq('buyer_phone', buyer_phone).eq('bundle_id', bundle_id)
        }
        return json({ success: true, transaction_code: apiData.transaction_code })

      } else {
        // DO NOT auto-refund — admin verifies on Cheap Bundles dashboard first
        // to avoid the risk of double-credit (API can fail but still deliver).
        if (transaction_id) {
          await db.from('transactions').update({
            delivery_status: 'pending_verification',
            delivery_error:  apiData.message ?? 'API error',
          }).eq('id', transaction_id)
        } else {
          await db.from('orders').update({
            delivery_status: 'pending_verification',
          }).eq('paystack_ref', paystack_ref).eq('buyer_phone', buyer_phone).eq('bundle_id', bundle_id)
        }
        return json({ success: false, error: apiData.message ?? 'Delivery failed — pending admin review' })
      }
    }

    return json({ error: 'Unknown action' }, 400)

  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})

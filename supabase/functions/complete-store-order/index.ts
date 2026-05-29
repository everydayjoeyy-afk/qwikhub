import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Secrets ───────────────────────────────────────────────────
const PAYSTACK_SECRET    = Deno.env.get('PAYSTACK_SECRET_KEY')       ?? ''
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')              ?? ''
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CHEAP_BUNDLES_BASE = 'https://cheap-bundles-ghana.azurewebsites.net/api/external/packages'
const API_KEY            = Deno.env.get('CHEAP_BUNDLES_API_KEY')     ?? ''

// Must match buy-bundle/index.ts
const NETWORK_IDS: Record<string, number> = {
  mtn:        3,
  telecel:    2,
  airteltigo: 1,
  tigo:       1,
}

// 2% Paystack processing fee deducted from the seller's profit (matches client/storefront math)
const PAYSTACK_FEE_RATE = 0.02

function parseGb(bundleValue: string): number {
  const m = String(bundleValue).match(/^(\d+(?:\.\d+)?)\s*gb$/i)
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
  if (req.method !== 'POST')   return json({ success: false, error: 'Method not allowed' }, 405)

  try {
    const { reference, store_id, items } = await req.json()

    if (!reference || !store_id || !Array.isArray(items) || items.length === 0) {
      return json({ success: false, error: 'Missing reference, store_id, or items' }, 400)
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // ── 1. Verify the payment with Paystack (server-side, can't be faked) ──
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
    )
    const verify = await verifyRes.json().catch(() => null)

    if (!verify?.status || verify?.data?.status !== 'success') {
      return json({ success: false, error: 'Payment could not be verified' }, 402)
    }
    const paidPesewas = Number(verify.data.amount ?? 0)

    // ── 2. Idempotency: if this reference was already processed, stop ──
    // Prevents double-credit / double-delivery (e.g. client retry + webhook).
    const { data: existing } = await db
      .from('orders')
      .select('id')
      .eq('paystack_ref', reference)
      .limit(1)

    if (existing && existing.length > 0) {
      return json({ success: true, alreadyProcessed: true })
    }

    // ── 3. Resolve the store → seller ──
    const { data: store, error: storeErr } = await db
      .from('stores')
      .select('id, user_id')
      .eq('id', store_id)
      .maybeSingle()

    if (storeErr || !store) return json({ success: false, error: 'Store not found' }, 404)

    // ── 4. Resolve prices SERVER-SIDE (never trust client-sent prices) ──
    let expectedTotal = 0
    const resolved: Array<{ item: Record<string, unknown>; platformPrice: number; salePrice: number; profit: number }> = []

    for (const item of items) {
      const bundleId = item.bundleId
      if (!bundleId) return json({ success: false, error: 'Missing bundleId on an item' }, 400)

      const { data: bundle } = await db
        .from('bundles')
        .select('id, platform_price')
        .eq('id', bundleId)
        .maybeSingle()

      if (!bundle) return json({ success: false, error: `Bundle not found: ${bundleId}` }, 400)

      const { data: sb } = await db
        .from('store_bundles')
        .select('custom_price')
        .eq('store_id', store_id)
        .eq('bundle_id', bundleId)
        .maybeSingle()

      const platformPrice = Number(bundle.platform_price)
      const salePrice     = Number(sb?.custom_price ?? platformPrice)
      const profit        = Math.max(0, salePrice - platformPrice - salePrice * PAYSTACK_FEE_RATE)

      expectedTotal += salePrice
      resolved.push({ item, platformPrice, salePrice, profit })
    }

    // ── 5. Validate amount — customer must have paid at least the order total ──
    // (+1 pesewa tolerance for any rounding). Blocks fake/cheaper-reference exploits.
    if (paidPesewas + 1 < Math.round(expectedTotal * 100)) {
      return json({ success: false, error: 'Amount paid is less than order total' }, 402)
    }

    // ── 6. Create orders + deliver each item ──
    const deliveries: Array<Record<string, unknown>> = []
    let totalProfit = 0

    for (const { item, salePrice, profit } of resolved) {
      const buyerPhone  = String(item.buyerPhone ?? '')
      const bundleId    = item.bundleId
      const networkId   = String(item.networkId ?? '')
      const bundleValue = String(item.bundleValue ?? '')

      // Insert the order (service role — bypasses RLS, no auth needed)
      const { data: order, error: orderErr } = await db
        .from('orders')
        .insert({
          buyer_phone:     buyerPhone,
          bundle_id:       bundleId,
          store_id,
          amount_paid:     salePrice,
          profit,
          payment_method:  'paystack',
          paystack_ref:    reference,
          status:          'paid',
          delivery_status: 'pending',
        })
        .select('id')
        .single()

      if (orderErr || !order) {
        deliveries.push({ bundleId, delivered: false, error: 'Order insert failed' })
        continue
      }

      // Seller earns on every paid order (admin reverses if a refund is ever issued)
      totalProfit += profit

      // Deliver via Cheap Bundles API
      const networkNum = NETWORK_IDS[networkId]
      const gb         = parseGb(bundleValue)
      let delivered    = false
      let txnCode: string | null = null

      if (networkNum && gb) {
        try {
          const apiRes = await fetch(`${CHEAP_BUNDLES_BASE}/buy-other`, {
            method:  'POST',
            headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              recipient_msisdn: buyerPhone,
              network_id:       networkNum,
              shared_bundle:    gb,
            }),
          })
          const apiData = await apiRes.json().catch(() => ({ success: false }))

          if (apiData.success) {
            delivered = true
            txnCode   = apiData.transaction_code ?? null
            await db.from('orders')
              .update({ delivery_status: 'delivered', transaction_code: txnCode })
              .eq('id', order.id)
          } else {
            // DO NOT auto-refund — admin verifies on the Cheap Bundles dashboard first
            await db.from('orders')
              .update({ delivery_status: 'pending_verification' })
              .eq('id', order.id)
          }
        } catch (_e) {
          await db.from('orders')
            .update({ delivery_status: 'pending_verification' })
            .eq('id', order.id)
        }
      } else {
        await db.from('orders')
          .update({ delivery_status: 'pending_verification' })
          .eq('id', order.id)
      }

      deliveries.push({ bundleId, delivered, transaction_code: txnCode })
    }

    // ── 7. Credit the seller's earnings (atomic: balance + transaction row) ──
    if (totalProfit > 0) {
      const { error: creditErr } = await db.rpc('credit_earnings', {
        p_user_id:     store.user_id,
        p_amount:      totalProfit,
        p_description: `Sale from store (${resolved.length} item${resolved.length > 1 ? 's' : ''})`,
        p_reference:   reference,
      })
      if (creditErr) {
        console.error('[complete-store-order] credit_earnings failed:', creditErr.message, { reference })
      }
    }

    return json({ success: true, deliveries })

  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500)
  }
})

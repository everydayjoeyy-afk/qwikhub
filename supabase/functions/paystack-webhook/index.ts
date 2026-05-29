import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYSTACK_SECRET  = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

// ── Verify Paystack HMAC-SHA512 signature ─────────────────────
async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!signature || !PAYSTACK_SECRET) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(PAYSTACK_SECRET),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const hash = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return hash === signature
}

serve(async (req: Request) => {
  // Paystack only sends POST; respond 200 to anything else so they don't retry
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 })
  }

  const body = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''

  // Verify signature — reject if tampered
  if (!await verifySignature(body, signature)) {
    console.error('[paystack-webhook] Invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let event: { event: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  // Only handle successful charges
  if (event.event !== 'charge.success') {
    return new Response('OK', { status: 200 })
  }

  const data     = event.data as Record<string, unknown>
  const reference = String(data.reference ?? '')

  // ── Storefront purchases ('QH-' prefix) — safety net ──────────
  // Normally completed client-side by complete-store-order right after payment.
  // If the customer's browser died before that fired, finish it here. The
  // complete-store-order function re-verifies the payment and is idempotent,
  // so a purchase already processed by the client is safely skipped.
  if (reference.startsWith('QH-')) {
    const metadata = (data.metadata ?? {}) as Record<string, unknown>
    const qh       = (metadata.qwikhub ?? {}) as Record<string, unknown>
    const storeId  = String(qh.store_id ?? '')
    const items    = Array.isArray(qh.items) ? qh.items : []

    if (!storeId || items.length === 0) {
      // No embedded order info — can't recover automatically. Log for manual review.
      console.error('[paystack-webhook] QH payment missing order metadata', { reference })
      return new Response('OK', { status: 200 })
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-store-order`, {
      method:  'POST',
      headers: {
        apikey:         ANON_KEY,
        Authorization:  `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reference, store_id: storeId, items }),
    })

    if (!res.ok) {
      console.error('[paystack-webhook] complete-store-order failed', { reference, status: res.status })
      // Return 500 so Paystack retries (up to 72 hours)
      return new Response('Processing failed', { status: 500 })
    }

    console.log('[paystack-webhook] ✅ Storefront order completed via webhook', { reference })
    return new Response('OK', { status: 200 })
  }

  // ── Wallet top-ups ('qwikhub_' prefix) ────────────────────────
  if (!reference.startsWith('qwikhub_')) {
    return new Response('OK', { status: 200 })
  }

  // Extract user info from metadata (added by AddMoneyModal)
  const metadata     = (data.metadata ?? {}) as Record<string, unknown>
  const userId       = String(metadata.user_id ?? '')
  const walletAmount = parseFloat(String(metadata.wallet_amount ?? '0'))

  if (!userId || isNaN(walletAmount) || walletAmount <= 0) {
    // Older payments without metadata — can't auto-credit, log for manual review
    console.error('[paystack-webhook] Missing metadata — manual credit needed', { reference })
    return new Response('OK', { status: 200 })
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Idempotency: skip if this reference was already credited (by client-side or a previous webhook call)
  const { data: existing } = await db
    .from('transactions')
    .select('id')
    .eq('reference', reference)
    .maybeSingle()

  if (existing) {
    console.log('[paystack-webhook] Already processed, skipping', { reference })
    return new Response('Already processed', { status: 200 })
  }

  // Credit the wallet atomically (balance + transaction row in one DB transaction)
  const { error } = await db.rpc('credit_wallet', {
    p_user_id:     userId,
    p_amount:      walletAmount,
    p_description: 'Wallet top-up via Paystack',
    p_reference:   reference,
  })

  if (error) {
    console.error('[paystack-webhook] credit_wallet failed:', error.message, { reference, userId })
    // Return 500 so Paystack retries (up to 72 hours)
    return new Response('Credit failed', { status: 500 })
  }

  console.log('[paystack-webhook] ✅ Credited', walletAmount, 'to user', userId, 'ref:', reference)
  return new Response('OK', { status: 200 })
})

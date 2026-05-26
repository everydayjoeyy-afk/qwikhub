import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYSTACK_SECRET  = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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

  // Only handle wallet top-ups (reference starts with 'qwikhub_').
  // Storefront payments use 'QH-' prefix and are handled client-side.
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

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Secrets ───────────────────────────────────────────────────
const CHEAP_BUNDLES_BASE = 'https://cheap-bundles-ghana.azurewebsites.net/api/external/packages'
const API_KEY          = Deno.env.get('CHEAP_BUNDLES_API_KEY')     ?? ''
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')              ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
// Optional shared secret. If set, callers must send a matching x-cron-secret header.
const CRON_SECRET      = Deno.env.get('CRON_SECRET')               ?? ''

// Cheap Bundles network_id → our carrier name (must match AdminStoreOverview)
const NETWORK_TO_CARRIER: Record<number, string> = { 1: 'AirtelTigo', 2: 'Telecel', 3: 'MTN' }

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // If a secret is configured, require it (blocks random triggers).
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  try {
    // 1. Fetch the live package list from Cheap Bundles
    const apiRes   = await fetch(`${CHEAP_BUNDLES_BASE}/all-packages`, { headers: { 'X-API-KEY': API_KEY } })
    const packages = await apiRes.json().catch(() => null)
    if (!Array.isArray(packages)) {
      return json({ success: false, error: 'Bad or empty API response' }, 502)
    }

    // 2. Build availability + cost lookup: 'Telecel-1GB' → console_price
    const costMap: Record<string, number> = {}
    for (const pkg of packages) {
      const carrier = NETWORK_TO_CARRIER[pkg.network_id]
      if (!carrier) continue
      costMap[`${carrier}-${pkg.volume}GB`] = pkg.console_price
    }

    // Safety: never deactivate the whole catalogue on a garbled/empty response
    if (Object.keys(costMap).length === 0) {
      return json({ success: false, error: 'API returned no packages — no changes made' }, 502)
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: bundles, error } = await db
      .from('bundles')
      .select('id, carrier, data_size, is_active, cost_price')
    if (error) return json({ success: false, error: error.message }, 500)

    let deactivated = 0
    let refreshed   = 0

    for (const b of bundles ?? []) {
      const key  = `${b.carrier}-${b.data_size}`
      const cost = costMap[key]

      if (cost == null) {
        // No longer offered by the API → stop showing/selling it.
        if (b.is_active) {
          await db.from('bundles').update({ is_active: false }).eq('id', b.id)
          deactivated++
        }
      } else if (Number(b.cost_price ?? -1) !== Number(cost)) {
        // Still offered → keep cost_price fresh (for accurate referral commission).
        // Deliberately does NOT touch platform_price (preserves manual pricing)
        // and does NOT auto-reactivate (admin sets price when re-enabling).
        await db.from('bundles').update({ cost_price: cost }).eq('id', b.id)
        refreshed++
      }
    }

    console.log('[sync-bundles] done', { deactivated, refreshed, checked: (bundles ?? []).length })
    return json({ success: true, deactivated, refreshed, checked: (bundles ?? []).length })

  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500)
  }
})

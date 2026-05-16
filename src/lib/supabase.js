import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// In production (Netlify), route Supabase calls through the CDN proxy defined
// in netlify.toml. The browser talks to the same origin (no CORS preflight),
// and Netlify's servers forward the request to Supabase over a fast backbone link.
// On localhost, hit Supabase directly as normal.
const supabaseUrl = import.meta.env.PROD
  ? `${window.location.origin}/sb-proxy`
  : SUPABASE_URL

export const supabase = createClient(supabaseUrl, SUPABASE_ANON_KEY, {
  auth: {
    storageKey:       'sb-qwikhub-session', // consistent key across dev/prod
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: true,
  },
})

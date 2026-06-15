import { createClient } from '@supabase/supabase-js'

// Fallbacks keep module import (and CI unit tests) from throwing when env is
// absent. Real values are injected at build time from env / GitHub secrets.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'http://localhost:54321'
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'public-anon-key'

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('VITE_SUPABASE_URL is not set — using a placeholder; data calls will fail.')
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wc26-auth' },
})

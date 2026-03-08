import { createClient } from '@supabase/supabase-js'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_KEY

let _client = null

export function getSupabaseClient() {
  if (_client) return _client
  if (!SB_URL || !SB_KEY) return null
  try {
    _client = createClient(SB_URL, SB_KEY)
  } catch (_) {
    _client = null
  }
  return _client
}

export const supabase = getSupabaseClient()

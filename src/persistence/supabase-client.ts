import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn(
      '[supabase] env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
    );
    return null;
  }
  cached = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'pkmn-booster:auth:v1',
    },
  });
  console.info('[supabase] client initialized:', url);
  return cached;
}

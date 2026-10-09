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
  // Sem Supabase Auth: o acesso é pelas funções poketcg_*, que exigem o PIN da família.
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.info('[supabase] client initialized:', url);
  return cached;
}

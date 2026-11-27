import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/**
 * Config pública de Supabase Auth. Null si falta, no es http(s), o sigue
 * el placeholder de `.env.example`. No hay URL de proyecto escrita en el código.
 */
export function readSupabaseConfig(): SupabaseConfig | null {
  const urlRaw = import.meta.env.VITE_SUPABASE_URL;
  const keyRaw = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof urlRaw !== 'string' || typeof keyRaw !== 'string') {
    return null;
  }
  const url = urlRaw.trim().replace(/\/$/, '');
  const anonKey = keyRaw.trim();
  if (!url || !anonKey || !/^https?:\/\//.test(url) || url.includes('YOUR_PROJECT')) {
    return null;
  }
  if (anonKey === 'your-anon-key') {
    return null;
  }
  return { url, anonKey };
}

export function createSupabase(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

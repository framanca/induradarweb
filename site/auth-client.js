import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';

let client;

export function getSupabaseClient() {
  if (client) return client;
  const url = window.INDURADAR_CONFIG?.supabaseUrl?.trim();
  const key = window.INDURADAR_CONFIG?.supabasePublishableKey?.trim();
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

export async function currentSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

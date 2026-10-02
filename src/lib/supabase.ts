import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// One client per sync key: each createClient spins up a GoTrueClient, and duplicates trigger a browser warning.
const clients = new Map<string, SupabaseClient>();

export function createSupabase(syncKey: string) {
  let client = clients.get(syncKey);
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { "x-sync-key": syncKey } } }
    );
    clients.set(syncKey, client);
  }
  return client;
}

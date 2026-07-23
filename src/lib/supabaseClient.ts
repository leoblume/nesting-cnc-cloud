import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Configuração via variáveis de ambiente (Vite):
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
//
// Essas variáveis devem ser definidas no .env local (dev) e nas variáveis de
// ambiente do Cloudflare Pages / Railway (produção). Sem elas, o app cai
// automaticamente para o cache local (localStorage) — ver ledModelsRepo.ts.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  }
  return client;
}

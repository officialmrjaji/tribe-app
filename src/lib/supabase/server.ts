import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "./config";

export function createSupabaseAdminClient() {
  const { key, url } = getSupabaseServerConfig();

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserConfig } from "./config";

export function createSupabaseBrowserClient() {
  const { key, url } = getSupabaseBrowserConfig();

  return createBrowserClient(url, key);
}

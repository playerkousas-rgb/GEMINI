import { createLocalStore } from "./local-store.js";
import { createCloudStore } from "./cloud-store.js";
import websiteTools from "../../data/website-gemini.json";

export async function createStore() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url && !key)
    return createLocalStore(undefined, {
      seedApps: websiteTools,
      seedVersion: "website-gemini-2026-10-18",
    });
  if (!url || !key)
    throw new Error("Supabase 設定不完整，請同時設定 URL 和 publishable key。");
  if (!/^https:\/\//.test(url))
    throw new Error("Supabase URL 必須使用 HTTPS。");
  if (!key.startsWith("sb_publishable_")) {
    // Legacy anon JWTs are supported; never accept a privileged service-role JWT.
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") throw new Error();
    } catch {
      throw new Error(
        "請使用 Supabase publishable key 或 anon key，不能使用 secret / service_role key。",
      );
    }
  }
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, {
    auth: {
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return createCloudStore(client);
}

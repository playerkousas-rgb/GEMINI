import { validateApps } from "../catalog.js";
import { CONFLICT_MESSAGE } from "./local-store.js";

function explain(error) {
  if (error?.message?.includes("CATALOG_CONFLICT"))
    return new Error(CONFLICT_MESSAGE);
  if (error?.message?.includes("ADMIN_REQUIRED") || error?.code === "42501") {
    return new Error("登入已失效或此帳戶沒有管理權限，請重新登入。");
  }
  return new Error(
    "雲端操作失敗，請檢查網絡及 Supabase 設定後重試；沒有改用本機儲存。",
  );
}

export function createCloudStore(client) {
  async function load() {
    const { data, error } = await client.rpc("get_gemini_catalog");
    if (error) throw explain(error);
    if (!data || !Number.isSafeInteger(data.revision))
      throw new Error("雲端回傳格式不正確。");
    return {
      apps: validateApps(data.apps),
      revision: data.revision,
      canEdit: data.can_edit === true,
    };
  }
  return {
    mode: "cloud",
    load,
    async save(apps, revision) {
      const { data, error } = await client.rpc("save_gemini_catalog", {
        p_apps: validateApps(apps),
        p_revision: revision,
      });
      if (error) throw explain(error);
      if (!data || !Number.isSafeInteger(data.revision))
        throw new Error("未能確認儲存結果，請重新載入確認後再操作。");
      return {
        apps: validateApps(data.apps),
        revision: data.revision,
        canEdit: true,
      };
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error("登入失敗，請檢查電郵、密碼及網絡。");
      const snapshot = await load();
      if (!snapshot.canEdit) {
        await client.auth.signOut();
        throw new Error("此帳戶沒有 Gemini 入口的管理權限。");
      }
      return snapshot;
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw explain(error);
    },
    subscribe(onSignOut) {
      const { data } = client.auth.onAuthStateChange((event) => {
        // Do not await Supabase calls inside this callback (auth mutex).
        if (event === "SIGNED_OUT") onSignOut();
      });
      return () => data.subscription.unsubscribe();
    },
  };
}

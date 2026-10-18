import { validateApps } from "../catalog.js";
import { CONFLICT_MESSAGE } from "./local-store.js";

// Lightweight shared-PIN gate. The PIN is checked inside the database RPCs,
// never hardcoded in the client, and kept only in this tab's sessionStorage.
export const PIN_STORAGE_KEY = "gemini-hub-pin-v1";

function explain(error) {
  if (error?.message?.includes("CATALOG_CONFLICT"))
    return new Error(CONFLICT_MESSAGE);
  if (error?.message?.includes("INVALID_PIN") || error?.code === "42501") {
    return new Error("管理密碼不正確或已失效，請重新輸入。");
  }
  if (error?.message?.includes("RATE_LIMITED")) {
    return new Error("今日回報次數已達上限，請稍後再試。");
  }
  return new Error(
    "雲端操作失敗，請檢查網絡及 Supabase 設定後重試；沒有改用本機儲存。",
  );
}

export function createCloudStore(client, getStorage = () => window.sessionStorage) {
  function readPin() {
    try {
      return getStorage().getItem(PIN_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }
  async function load(pin = readPin()) {
    const { data, error } = await client.rpc("get_gemini_catalog", {
      p_pin: pin,
    });
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
        p_pin: readPin(),
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
    async signIn(password) {
      const pin = String(password ?? "");
      if (!pin) throw new Error("請輸入管理密碼。");
      // The PIN is verified server-side by the RPC; wrong PIN reads as can_edit=false.
      const snapshot = await load(pin);
      if (!snapshot.canEdit) throw new Error("管理密碼不正確。");
      try {
        getStorage().setItem(PIN_STORAGE_KEY, pin);
      } catch {
        throw new Error("無法記住登入狀態，請檢查瀏覽器設定後重試。");
      }
      return snapshot;
    },
    async signOut() {
      try {
        getStorage().removeItem(PIN_STORAGE_KEY);
      } catch {
        /* nothing sensitive is stored; ignore */
      }
    },
    subscribe() {
      return () => {};
    },
    async trackClick(toolId) {
      // Fire-and-forget analytics: never block navigation, never surface errors.
      try {
        await client.rpc("record_gemini_click", { p_tool_id: toolId });
      } catch {
        /* ignore */
      }
    },
    async submitReport(toolId, toolTitle, message) {
      const { error } = await client.rpc("submit_gemini_report", {
        p_tool_id: toolId,
        p_tool_title: toolTitle ?? "",
        p_message: message ?? "",
      });
      if (error) throw explain(error);
    },
    async loadStats() {
      const { data, error } = await client.rpc("get_gemini_stats", {
        p_pin: readPin(),
      });
      if (error) throw explain(error);
      return data ?? { totals: [], daily: [], grand_total: 0, today: 0 };
    },
    async loadReports() {
      const { data, error } = await client.rpc("get_gemini_reports", {
        p_pin: readPin(),
      });
      if (error) throw explain(error);
      return data ?? { reports: [], total: 0 };
    },
    async deleteReport(id) {
      const { error } = await client.rpc("delete_gemini_report", {
        p_pin: readPin(),
        p_id: id,
      });
      if (error) throw explain(error);
    },
  };
}

import { validateApps } from "../catalog.js";

export const DRAFT_KEY = "gemini-hub-draft-v1";
export const CONFLICT_MESSAGE =
  "清單已在另一個視窗更新。請先備份未儲存內容，再重新載入，避免覆蓋較新的版本。";

// A deliberately separate namespace: local drafts are never uploaded automatically.
export function createLocalStore(
  getStorage = () => window.localStorage,
  { seedApps = [], seedVersion = "" } = {},
) {
  const seeds = validateApps(seedApps);
  if (seeds.length && !seedVersion) throw new Error("預設清單需要版本識別。");

  function persist(snapshot, appliedSeedVersion) {
    try {
      getStorage().setItem(
        DRAFT_KEY,
        JSON.stringify({ ...snapshot, seedVersion: appliedSeedVersion }),
      );
    } catch {
      throw new Error(
        "本機儲存失敗，可能空間不足或瀏覽器禁止儲存。內容未儲存，請保留表單或下載備份。",
      );
    }
  }

  function read() {
    const raw = getStorage().getItem(DRAFT_KEY);
    let snapshot = { apps: [], revision: 0, canEdit: true };
    let appliedSeedVersion = "";
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (!Number.isSafeInteger(data.revision) || data.revision < 0)
          throw new Error();
        snapshot = {
          apps: validateApps(data.apps),
          revision: data.revision,
          canEdit: true,
        };
        appliedSeedVersion =
          typeof data.seedVersion === "string" ? data.seedVersion : "";
      } catch {
        throw new Error(
          "本機草稿無法讀取。請先備份瀏覽器內的草稿資料，不會自動清空或覆蓋。",
        );
      }
    }
    if (seedVersion && appliedSeedVersion !== seedVersion) {
      // Merge once, preserving personal edits, ordering and existing duplicates by URL/ID.
      const ids = new Set(snapshot.apps.map((app) => app.id));
      const urls = new Set(snapshot.apps.map((app) => app.url));
      const missing = seeds.filter(
        (app) => !ids.has(app.id) && !urls.has(app.url),
      );
      snapshot = {
        apps: validateApps([...snapshot.apps, ...missing]),
        revision: snapshot.revision + 1,
        canEdit: true,
      };
      appliedSeedVersion = seedVersion;
      persist(snapshot, appliedSeedVersion);
    }
    return { snapshot, appliedSeedVersion };
  }
  function load() {
    return read().snapshot;
  }

  return {
    mode: "local",
    load,
    async save(apps, revision) {
      const validated = validateApps(apps);
      const { snapshot, appliedSeedVersion } = read();
      if (snapshot.revision !== revision) throw new Error(CONFLICT_MESSAGE);
      const next = { apps: validated, revision: revision + 1, canEdit: true };
      // Keep the marker after deletions/imports so removed defaults never reappear.
      persist(next, appliedSeedVersion);
      return next;
    },
    async signIn() {
      return load();
    },
    async signOut() {},
    subscribe() {
      return () => {};
    },
    async trackClick() {},
    async submitReport() {
      throw new Error("本機試用未連接雲端，未能送出回報。");
    },
    async loadStats() {
      return { totals: [], daily: [], grand_total: 0, today: 0 };
    },
    async loadReports() {
      return { reports: [], total: 0 };
    },
    async deleteReport() {},
  };
}

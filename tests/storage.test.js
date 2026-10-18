import test from "node:test";
import assert from "node:assert/strict";
import { createLocalStore, DRAFT_KEY } from "../src/data/local-store.js";
import {
  createCloudStore,
  PIN_STORAGE_KEY,
} from "../src/data/cloud-store.js";
const tool = {
  id: "one",
  title: "工具",
  desc: "介紹",
  emoji: "🧩",
  url: "https://gemini.google.com/share/test",
  category: "工具",
  visible: true,
};
function memory() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

test("local tools survive new store instances, including hidden state and order", async () => {
  const storage = memory();
  const first = createLocalStore(() => storage);
  assert.deepEqual(first.load().apps, []);
  const saved = await first.save(
    [tool, { ...tool, id: "two", visible: false }],
    0,
  );
  assert.equal(saved.revision, 1);
  const second = createLocalStore(() => storage);
  assert.deepEqual(second.load(), saved);
  await second.save([...saved.apps].reverse(), 1);
  assert.equal(first.load().apps[0].id, "two");
  await first.save([], 2);
  assert.deepEqual(second.load().apps, []);
});
test("stale local writers cannot overwrite newer changes", async () => {
  // Use shared storage for two operations.
  const storage = memory(),
    shared = createLocalStore(() => storage);
  await shared.save([tool], 0);
  await assert.rejects(shared.save([], 0), /另一個視窗/);
  assert.equal(shared.load().apps.length, 1);
});
test("corrupted drafts and failed persistence never report success", async () => {
  const storage = memory();
  storage.setItem(DRAFT_KEY, "{invalid");
  const corrupt = createLocalStore(() => storage);
  assert.throws(() => corrupt.load(), /不會自動清空/);
  await assert.rejects(corrupt.save([], 0));
  assert.equal(storage.getItem(DRAFT_KEY), "{invalid");
  const blocked = createLocalStore(() => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  }));
  await assert.rejects(blocked.save([tool], 0), /本機儲存失敗/);
});
test("cloud writes carry revision, PIN and visibility; errors do not fall back to local", async () => {
  const calls = [];
  const store = createCloudStore(
    {
      rpc: async (name, params) => {
        calls.push({ name, params });
        return { data: { apps: params.p_apps, revision: 2 }, error: null };
      },
    },
    memory,
  );
  assert.equal((await store.save([tool], 1)).revision, 2);
  assert.equal(calls[0].name, "save_gemini_catalog");
  assert.equal(calls[0].params.p_revision, 1);
  assert.equal(calls[0].params.p_pin, null); // no stored PIN yet
  const conflict = createCloudStore(
    { rpc: async () => ({ error: { message: "CATALOG_CONFLICT" } }) },
    memory,
  );
  await assert.rejects(conflict.save([tool], 1), /另一個視窗/);
  const offline = createCloudStore(
    { rpc: async () => ({ error: { message: "offline" } }) },
    memory,
  );
  await assert.rejects(offline.save([tool], 1), /沒有改用本機/);
});
test("shared PIN unlocks the editor; wrong PIN is refused and stored nowhere", async () => {
  const storage = memory();
  const client = {
    rpc: async (name, params) => {
      if (name === "get_gemini_catalog") {
        const ok = params?.p_pin === "0728";
        return {
          data: {
            apps: ok ? [tool] : [],
            revision: 0,
            can_edit: ok,
          },
          error: null,
        };
      }
      if (name === "save_gemini_catalog") {
        return {
          data: { apps: [tool], revision: 1, can_edit: true },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };
  const store = createCloudStore(client, () => storage);
  await assert.rejects(store.signIn("9999"), /密碼不正確/);
  assert.equal(storage.getItem(PIN_STORAGE_KEY), null);
  await assert.rejects(store.signIn(""), /請輸入管理密碼/);
  const snapshot = await store.signIn("0728");
  assert.equal(snapshot.canEdit, true);
  assert.equal(storage.getItem(PIN_STORAGE_KEY), "0728");
  const calls = [];
  const tracked = createCloudStore(
    {
      rpc: async (name, params) => {
        calls.push({ name, params });
        return {
          data:
            name === "save_gemini_catalog"
              ? { apps: [tool], revision: 1, can_edit: true }
              : null,
          error: null,
        };
      },
    },
    () => storage,
  );
  await tracked.save([tool], 0);
  assert.equal(calls[0].params.p_pin, "0728"); // stored PIN travels with writes
  await store.signOut();
  assert.equal(storage.getItem(PIN_STORAGE_KEY), null);
});
test("click tracking never blocks; reports surface honest errors", async () => {
  const failing = createCloudStore(
    { rpc: async () => ({ error: { message: "offline" } }) },
    memory,
  );
  await failing.trackClick("one"); // fire-and-forget: must not throw
  await assert.rejects(failing.submitReport("one", "工具", "壞了"), /雲端操作失敗/);
  const limited = createCloudStore(
    { rpc: async () => ({ error: { message: "RATE_LIMITED" } }) },
    memory,
  );
  await assert.rejects(limited.submitReport("one", "工具", "x"), /今日回報/);
  const calls = [];
  const ok = createCloudStore(
    {
      rpc: async (name, params) => {
        calls.push({ name, params });
        return { data: { reports: [], total: 0 }, error: null };
      },
    },
    () => storageWithPin(),
  );
  await ok.trackClick("one");
  assert.equal(calls[0].name, "record_gemini_click");
  await ok.submitReport("one", "工具", "壞了");
  assert.equal(calls[1].name, "submit_gemini_report");
  assert.equal(calls[1].params.p_message, "壞了");
  assert.deepEqual(await ok.loadReports(), { reports: [], total: 0 });
  function storageWithPin() {
    const s = memory();
    s.setItem(PIN_STORAGE_KEY, "0728");
    return s;
  }
});
test("local mode keeps engagement features honest without a cloud backend", async () => {
  const store = createLocalStore(() => memory());
  await store.trackClick("one"); // no-op
  await assert.rejects(store.submitReport("one", "工具", "x"), /未連接雲端/);
  assert.deepEqual(await store.loadStats(), {
    totals: [],
    daily: [],
    grand_total: 0,
    today: 0,
  });
});
test("website defaults merge once without overwriting drafts or reviving deleted tools", async () => {
  const storage = memory();
  const old = createLocalStore(() => storage);
  const customized = {
    ...tool,
    id: "custom-id",
    title: "我的自訂名稱",
    visible: false,
  };
  await old.save([customized], 0);
  const options = {
    seedApps: [
      tool,
      { ...tool, id: "another", url: "https://example.com/new" },
    ],
    seedVersion: "website-v1",
  };
  const upgraded = createLocalStore(() => storage, options);
  const merged = upgraded.load();
  assert.equal(merged.apps.length, 2);
  assert.deepEqual(merged.apps[0], customized); // URL match preserves edits and hidden state
  assert.equal(merged.revision, 2);
  assert.deepEqual(upgraded.load(), merged); // StrictMode or repeated reads do not re-seed
  await upgraded.save([], merged.revision);
  assert.deepEqual(createLocalStore(() => storage, options).load().apps, []);
});

test("seed merge deduplicates by ID and does not overwrite corrupted data", async () => {
  const storage = memory();
  const custom = {
    ...tool,
    title: "我的版本",
    url: "https://example.com/changed",
  };
  await createLocalStore(() => storage).save([custom], 0);
  const options = { seedApps: [tool], seedVersion: "website-v1" };
  assert.deepEqual(createLocalStore(() => storage, options).load().apps, [
    custom,
  ]);
  storage.setItem(DRAFT_KEY, "broken");
  assert.throws(
    () => createLocalStore(() => storage, options).load(),
    /不會自動清空/,
  );
  assert.equal(storage.getItem(DRAFT_KEY), "broken");
});

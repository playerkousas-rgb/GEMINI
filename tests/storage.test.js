import test from "node:test";
import assert from "node:assert/strict";
import { createLocalStore, DRAFT_KEY } from "../src/data/local-store.js";
import { createCloudStore } from "../src/data/cloud-store.js";
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
test("cloud writes carry revision and visibility; errors do not fall back to local", async () => {
  const calls = [];
  const store = createCloudStore({
    rpc: async (name, params) => {
      calls.push({ name, params });
      return { data: { apps: params.p_apps, revision: 2 }, error: null };
    },
  });
  assert.equal((await store.save([tool], 1)).revision, 2);
  assert.equal(calls[0].name, "save_gemini_catalog");
  assert.equal(calls[0].params.p_revision, 1);
  const conflict = createCloudStore({
    rpc: async () => ({ error: { message: "CATALOG_CONFLICT" } }),
  });
  await assert.rejects(conflict.save([tool], 1), /另一個視窗/);
  const offline = createCloudStore({
    rpc: async () => ({ error: { message: "offline" } }),
  });
  await assert.rejects(offline.save([tool], 1), /沒有改用本機/);
});
test("authenticated non-admin is signed out and refused editing", async () => {
  let signedOut = false;
  const store = createCloudStore({
    auth: {
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => {
        signedOut = true;
        return {};
      },
    },
    rpc: async () => ({ data: { apps: [], revision: 0, can_edit: false } }),
  });
  await assert.rejects(
    store.signIn("test@example.com", "test"),
    /沒有.*管理權限/,
  );
  assert.equal(signedOut, true);
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

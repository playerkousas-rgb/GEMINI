import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Simulate Supabase roles and auth.uid in isolated PostgreSQL WASM.
// These fixtures are not real accounts and are never sent to a remote service.
const admin = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const tool = {
  id: "first",
  title: "工具",
  desc: "介紹",
  emoji: "🧩",
  category: "工具",
  url: "https://gemini.google.com/share/test",
  visible: true,
};

test("database enforces admin-only writes, hidden records, validation and revision conflicts", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      insert into auth.users values ('${admin}'), ('${other}');`);
    const sql = await readFile(
      new URL("../migrations/001_gemini_hub.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql); // idempotent setup, no destructive reset
    await db.query("insert into public.gemini_hub_admins values ($1)", [admin]);
    async function role(role, uid = "") {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
        uid,
      ]);
      await db.exec(`set role ${role}`);
    }
    async function read() {
      return (await db.query("select public.get_gemini_catalog() as data"))
        .rows[0].data;
    }
    async function save(apps, revision) {
      return (
        await db.query(
          "select public.save_gemini_catalog($1::jsonb, $2) as data",
          [JSON.stringify(apps), revision],
        )
      ).rows[0].data;
    }
    await role("anon");
    assert.deepEqual((await read()).apps, []);
    await assert.rejects(save([tool], 0), /permission denied/);
    await assert.rejects(
      db.query("select * from public.gemini_hub_state"),
      /permission denied/,
    );
    await role("authenticated", other);
    await assert.rejects(save([tool], 0), /ADMIN_REQUIRED/);
    await assert.rejects(
      db.query(`insert into public.gemini_hub_admins values ('${other}')`),
      /permission denied/,
    );
    await role("authenticated", admin);
    const hidden = { ...tool, id: "secret", title: "隱藏工具", visible: false };
    assert.equal((await save([tool, hidden], 0)).revision, 1);
    assert.equal((await read()).apps.length, 2);
    await assert.rejects(save([], 0), /CATALOG_CONFLICT/);
    for (const invalid of [
      [tool, tool],
      [{ ...tool, url: "javascript:alert(1)" }],
      [{ ...tool, visible: "yes" }],
      [{ ...tool, category: "invalid" }],
      [{ ...tool, title: "" }],
      [{ ...tool, url: "https://user:password@example.com" }],
      [{ ...tool, url: "/tools/../admin" }],
    ]) {
      await assert.rejects(save(invalid, 1));
    }
    assert.equal((await read()).revision, 1);
    await role("anon");
    const publicView = await read();
    assert.deepEqual(publicView.apps, [tool]);
    assert.equal(publicView.can_edit, false);
    await role("authenticated", other);
    assert.deepEqual((await read()).apps, [tool]);
    await role("authenticated", admin);
    await save([hidden, tool], 1);
    assert.equal((await read()).apps[0].id, "secret");
    await save([], 2);
    assert.deepEqual((await read()).apps, []);
  } finally {
    await db.close();
  }
});

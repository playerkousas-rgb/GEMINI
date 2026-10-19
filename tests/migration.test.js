import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Simulate Supabase roles in isolated PostgreSQL WASM.
// These fixtures are not real accounts and are never sent to a remote service.
const tool = {
  id: "first",
  title: "工具",
  desc: "介紹",
  emoji: "🧩",
  category: "工具",
  url: "https://gemini.google.com/share/test",
  visible: true,
  showDesc: false,
};
const PIN = "0728";

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
  for (const file of [
    "../migrations/001_gemini_hub.sql",
    "../migrations/002_gemini_pin_report_stats.sql",
    "../migrations/003_gemini_hub_retention.sql",
    "../migrations/004_gemini_show_desc.sql",
  ]) {
    const sql = await readFile(new URL(file, import.meta.url), "utf8");
    await db.exec(sql);
    await db.exec(sql); // idempotent setup, no destructive reset
  }
  return db;
}

async function asAnon(db) {
  await db.exec("reset role");
  await db.exec("set role anon");
}

test("PIN gate replaces auth whitelist: hidden records, validation, conflicts", async () => {
  const db = await setup();
  try {
    async function read(pin) {
      return (
        await db.query("select public.get_gemini_catalog($1) as data", [pin])
      ).rows[0].data;
    }
    async function save(apps, revision, pin) {
      return (
        await db.query(
          "select public.save_gemini_catalog($1::jsonb, $2, $3) as data",
          [JSON.stringify(apps), revision, pin],
        )
      ).rows[0].data;
    }
    await asAnon(db);
    assert.deepEqual((await read(null)).apps, []);
    assert.equal((await read(null)).can_edit, false);
    await assert.rejects(save([tool], 0, null), /INVALID_PIN/);
    await assert.rejects(save([tool], 0, "9999"), /INVALID_PIN/);
    await assert.rejects(
      db.query("select * from public.gemini_hub_state"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.gemini_hub_admins"),
      /does not exist/,
    );
    const hidden = { ...tool, id: "secret", title: "隱藏工具", visible: false };
    assert.equal((await save([tool, hidden], 0, PIN)).revision, 1);
    assert.equal((await read(PIN)).apps.length, 2);
    assert.equal((await read(PIN)).can_edit, true);
    await assert.rejects(save([], 0, PIN), /CATALOG_CONFLICT/);
    for (const invalid of [
      [tool, tool],
      [{ ...tool, url: "javascript:alert(1)" }],
      [{ ...tool, visible: "yes" }],
      [{ ...tool, showDesc: "yes" }],
      [{ ...tool, category: "invalid" }],
      [{ ...tool, title: "" }],
      [{ ...tool, url: "https://user:password@example.com" }],
      [{ ...tool, url: "/tools/../admin" }],
    ]) {
      await assert.rejects(save(invalid, 1, PIN));
    }
    assert.equal((await read(PIN)).revision, 1);
    const publicView = await read(null);
    assert.deepEqual(publicView.apps, [tool]);
    assert.equal(publicView.can_edit, false);
    // showDesc round-trips; legacy items without the flag default to public.
    await save([{ ...tool, showDesc: true }, hidden], 1, PIN);
    assert.equal((await read(PIN)).apps[0].showDesc, true);
    const legacy = { ...tool };
    delete legacy.showDesc;
    await save([hidden, legacy], 2, PIN);
    assert.equal((await read(PIN)).apps[0].id, "secret");
    assert.equal((await read(PIN)).apps[1].showDesc, true);
    await save([{ ...tool, showDesc: false }], 3, PIN);
    assert.equal((await read(PIN)).apps[0].showDesc, false);
    await save([], 4, PIN);
    assert.deepEqual((await read(PIN)).apps, []);
  } finally {
    await db.close();
  }
});

test("clicks aggregate per day instead of storing raw event rows", async () => {
  const db = await setup();
  try {
    await db.query(
      `insert into public.gemini_hub_clicks (tool_id, day, count)
       values ('ancient', current_date - 400, 7), ('recent', current_date - 30, 2)`,
    );
    await asAnon(db);
    await assert.rejects(
      db.query("select public.record_gemini_click($1)", [""]),
      /INVALID_TOOL_ID/,
    );
    for (let i = 0; i < 3; i += 1) {
      await db.query("select public.record_gemini_click($1)", [tool.id]);
    }
    await db.query("select public.record_gemini_click($1)", ["second"]);
    await assert.rejects(
      db.query("select * from public.gemini_hub_clicks"),
      /permission denied/,
    );
    await db.exec("reset role");
    const rows = (
      await db.query(
        "select tool_id, count from public.gemini_hub_clicks order by tool_id",
      )
    ).rows;
    assert.deepEqual(rows, [
      { tool_id: "first", count: 3 },
      { tool_id: "recent", count: 2 },
      { tool_id: "second", count: 1 },
    ]);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select public.get_gemini_stats($1)", ["9999"]),
      /INVALID_PIN/,
    );
    const stats = (
      await db.query("select public.get_gemini_stats($1) as data", [PIN])
    ).rows[0].data;
    assert.equal(stats.grand_total, 6);
    assert.equal(stats.today, 4);
    assert.deepEqual(stats.totals, [
      { tool_id: "first", count: 3 },
      { tool_id: "recent", count: 2 },
      { tool_id: "second", count: 1 },
    ]);
    assert.equal(stats.daily.length, 2);
  } finally {
    await db.close();
  }
});

test("reports: anonymous intake, validation, pruning, daily cap, PIN inbox", async () => {
  const db = await setup();
  try {
    async function submit(title, message) {
      await db.query("select public.submit_gemini_report($1, $2, $3)", [
        tool.id,
        title,
        message,
      ]);
    }
    await asAnon(db);
    await assert.rejects(submit("x", "y".repeat(301)), /INVALID_MESSAGE/);
    await assert.rejects(
      db.query("select public.submit_gemini_report($1, $2, $3)", [
        "a".repeat(65),
        "t",
        "m",
      ]),
      /INVALID_TOOL_ID/,
    );
    await assert.rejects(
      db.query("select public.get_gemini_reports($1)", ["9999"]),
      /INVALID_PIN/,
    );
    await assert.rejects(
      db.query("select * from public.gemini_hub_reports"),
      /permission denied/,
    );
    // A stale report is pruned on the next submission (90-day retention).
    await db.exec("reset role");
    await db.query(
      `insert into public.gemini_hub_reports (tool_id, tool_title, message, created_at)
       values ('old', '舊回報', 'stale', now() - interval '100 days')`,
    );
    await db.exec("set role anon");
    await submit("工具", "連結失效：打不開");
    await db.exec("reset role");
    const remaining = (
      await db.query("select tool_title from public.gemini_hub_reports")
    ).rows;
    assert.deepEqual(remaining, [{ tool_title: "工具" }]);
    // Daily cap: 20 submissions per day, then RATE_LIMITED.
    await db.exec("set role anon");
    for (let i = 0; i < 19; i += 1) await submit("工具", `msg ${i}`);
    await assert.rejects(submit("工具", "one too many"), /RATE_LIMITED/);
    const inbox = (
      await db.query("select public.get_gemini_reports($1) as data", [PIN])
    ).rows[0].data;
    assert.equal(inbox.total, 20);
    assert.equal(inbox.reports.length, 20);
    const first = inbox.reports[0];
    await assert.rejects(
      db.query("select public.delete_gemini_report($1, $2)", [
        "9999",
        first.id,
      ]),
      /INVALID_PIN/,
    );
    await db.query("select public.delete_gemini_report($1, $2)", [
      PIN,
      first.id,
    ]);
    const after = (
      await db.query("select public.get_gemini_reports($1) as data", [PIN])
    ).rows[0].data;
    assert.equal(after.total, 19);
  } finally {
    await db.close();
  }
});

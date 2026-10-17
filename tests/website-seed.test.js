import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateApps } from "../src/catalog.js";
import { createLocalStore } from "../src/data/local-store.js";

test("six WEBSITE Gemini tools seed fresh browsers with exact case-sensitive share URLs", async () => {
  const tools = validateApps(
    JSON.parse(
      await readFile(
        new URL("../data/website-gemini.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  assert.deepEqual(
    tools.map((tool) => [tool.title, tool.url]),
    [
      ["美食攝影", "https://share.gemini.google/HqZz4M9LUxDy"],
      ["卡牌生成器", "https://share.gemini.google/EnnFLUKmEO0s"],
      ["AI 對話助手", "https://share.gemini.google/wMmeJ0SInTEQ"],
      ["童設計", "https://share.gemini.google/snrL7mLrTDdu"],
      ["魔衣廚", "https://share.gemini.google/kEM7bkoAVIP0"],
      ["相片工作台", "https://share.gemini.google/wRhLIpy0Bnvb"],
    ],
  );
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const store = createLocalStore(() => storage, {
    seedApps: tools,
    seedVersion: "website-v1",
  });
  assert.deepEqual(store.load().apps, tools);
  assert.equal(store.load().revision, 1);
});

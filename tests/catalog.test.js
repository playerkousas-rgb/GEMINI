import test from "node:test";
import assert from "node:assert/strict";
import { isSafeToolUrl, validateApps } from "../src/catalog.js";
const app = {
  id: "one",
  title: "工具",
  emoji: "🧩",
  desc: "",
  url: "/tools/example/",
  category: "工具",
  visible: true,
};

test("accepts local tools and HTTPS Gemini links", () => {
  for (const url of [
    "/tools/example/",
    "/tools/demo.html",
    "https://gemini.google.com/share/abc",
  ])
    assert.equal(isSafeToolUrl(url), true);
});
test("rejects executable, insecure, malformed and escaping URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "http://example.com",
    "//evil.com",
    "/tools/../../admin",
    "/tools/\\evil.com",
    "https://",
    "https://user:pass@example.com",
    " https://example.com",
    null,
  ])
    assert.equal(isSafeToolUrl(url), false, String(url));
});
test("accepts valid and empty catalogs", () => {
  assert.deepEqual(validateApps([app]), [app]);
  assert.deepEqual(validateApps([]), []);
});
test("rejects incomplete entries, duplicate IDs and unknown categories", () => {
  for (const data of [
    {},
    [null],
    [{ title: "incomplete" }],
    [app, app],
    [{ ...app, id: "" }],
    [{ ...app, desc: 2 }],
    [{ ...app, category: "unknown" }],
    [{ ...app, url: "javascript:alert(1)" }],
  ])
    assert.throws(() => validateApps(data));
});

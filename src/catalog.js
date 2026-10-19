export const CATEGORIES = ["創作", "教學", "輔導", "工具", "遊戲"];

export function isSafeToolUrl(value) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    /[\\\s\u0000-\u001f]/.test(value)
  )
    return false;
  try {
    const url = new URL(value, "https://hub.invalid");
    if (value.startsWith("/tools/")) {
      return (
        url.origin === "https://hub.invalid" &&
        url.pathname.startsWith("/tools/")
      );
    }
    return (
      value.startsWith("https://") &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function validateApps(value) {
  if (!Array.isArray(value)) throw new Error("工具清單必須是 JSON 陣列。");
  if (value.length > 500) throw new Error("最多可儲存 500 個工具。");
  const ids = new Set();
  return value.map((app, index) => {
    const fail = (message) => {
      throw new Error(`第 ${index + 1} 個工具：${message}`);
    };
    if (!app || typeof app !== "object") fail("格式不正確");
    for (const field of ["id", "title", "emoji", "desc", "url", "category"]) {
      if (typeof app[field] !== "string") fail(`${field} 必須是文字`);
    }
    if (!app.id.trim() || ids.has(app.id)) fail("id 必須非空且唯一");
    ids.add(app.id);
    if (!app.title.trim() || !app.emoji.trim()) fail("請填寫標題及圖示");
    if (!CATEGORIES.includes(app.category)) fail("分類不正確");
    if (!isSafeToolUrl(app.url)) fail("只接受 https:// 網址或 /tools/ 路徑");
    for (const [field, limit] of Object.entries({
      id: 64,
      title: 100,
      emoji: 32,
      desc: 300,
      url: 2048,
    })) {
      if (app[field].length > limit) fail(`${field} 長度超出上限 ${limit}`);
    }
    if (app.visible !== undefined && typeof app.visible !== "boolean")
      fail("visible 必須為布林值");
    if (app.showDesc !== undefined && typeof app.showDesc !== "boolean")
      fail("showDesc 必須為布林值");
    return {
      visible: app.visible ?? true,
      showDesc: app.showDesc ?? false,
      ...Object.fromEntries(
        ["id", "title", "emoji", "desc", "url", "category"].map((key) => [
          key,
          app[key],
        ]),
      ),
    };
  });
}

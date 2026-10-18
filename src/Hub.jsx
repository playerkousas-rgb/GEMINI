import React, { useCallback, useEffect, useRef, useState } from "react";
import App from "./App.jsx";

export default function Hub({ store, initialSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const saving = useRef(false);
  const current = useRef(initialSnapshot);
  function accept(next) {
    current.current = next;
    setSnapshot(next);
  }
  useEffect(
    () =>
      store.subscribe(() => {
        const safe = {
          ...current.current,
          canEdit: false,
          apps: current.current.apps.filter((app) => app.visible),
        };
        current.current = safe;
        setSnapshot(safe);
        setNotice({ type: "error", text: "已登出。請重新輸入管理密碼以管理工具。" });
      }),
    [store],
  );

  const report = useCallback(
    (text, type = "error") => setNotice({ text, type }),
    [],
  );
  async function save(nextApps) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const next = await store.save(nextApps, current.current.revision);
      accept(next);
      report(
        store.mode === "local"
          ? "已儲存到此瀏覽器，未公開發布。"
          : "已儲存到雲端，公開工具清單已更新。",
        "success",
      );
      return true;
    } catch (error) {
      report(error.message);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function login(password) {
    const next = await store.signIn(password);
    accept(next);
    setNotice(null);
  }
  async function logout() {
    try {
      await store.signOut();
      accept({ ...current.current, canEdit: false });
      setNotice(null);
      return true;
    } catch (error) {
      report(error.message);
      return false;
    }
  }
  async function submitReport(toolId, toolTitle, message) {
    await store.submitReport(toolId, toolTitle, message);
    report("已收到你的回報，多謝幫忙！", "success");
  }
  const loadStats = useCallback(() => store.loadStats(), [store]);
  const loadReports = useCallback(() => store.loadReports(), [store]);
  async function deleteReport(id) {
    await store.deleteReport(id);
    report("已刪除該則回報。", "success");
  }
  const trackClick = useCallback((toolId) => store.trackClick(toolId), [store]);
  return (
    <App
      apps={snapshot.apps}
      canEdit={snapshot.canEdit}
      mode={store.mode}
      busy={busy}
      notice={notice}
      onSave={save}
      onLogin={login}
      onLogout={logout}
      onNotice={report}
      onReport={submitReport}
      onTrackClick={trackClick}
      onLoadStats={loadStats}
      onLoadReports={loadReports}
      onDeleteReport={deleteReport}
    />
  );
}

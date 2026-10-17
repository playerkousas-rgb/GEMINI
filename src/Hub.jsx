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
        setNotice({ type: "error", text: "已登出。請重新登入以管理工具。" });
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
  async function login(email, password) {
    const next = await store.signIn(email, password);
    accept(next);
    setNotice(null);
  }
  async function logout() {
    try {
      await store.signOut();
      return true;
    } catch (error) {
      report(error.message);
      return false;
    }
  }
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
    />
  );
}

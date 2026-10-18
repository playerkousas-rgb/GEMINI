import React, { useEffect, useRef, useState } from "react";

export default function LoginDialog({ mode, onLogin, onClose }) {
  const dialog = useRef(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current.showModal();
    return () => {
      previousFocus?.focus();
    };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onLogin(password);
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="login-dialog glass-panel"
      aria-labelledby="login-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <span className="eyebrow">GEMINI TOOLS HUB / EDIT</span>
          <button
            type="button"
            className="quiet-button"
            aria-label="關閉登入"
            disabled={busy}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <h2 id="login-title">
          {mode === "local" ? "先試試你的工具入口" : "管理入口"}
        </h2>
        <p>
          {mode === "local"
            ? "Supabase 尚未連接。你可以先試填名稱、介紹及 Share Link，新增的方塊只儲存在這個瀏覽器，不會公開發布。"
            : "輸入管理密碼即可新增、修改及發布工具，並查看點擊統計及回報。"}
        </p>
        {mode === "cloud" && (
          <label className="dialog-label">
            密碼
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </label>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy} type="submit">
          {busy
            ? "正在登入…"
            : mode === "local"
              ? "進入本機試用 →"
              : "進入管理 →"}
        </button>
        <p className="dialog-note">
          {mode === "local"
            ? "不需要密碼。這不是管理員驗證，也不是雲端發布。"
            : "只是一個輕量管理密碼，用作保護統計及編輯功能。"}
        </p>
      </form>
    </dialog>
  );
}

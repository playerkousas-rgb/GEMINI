import React, { useEffect, useRef, useState } from "react";

const REASONS = ["連結失效", "介紹錯誤", "其他問題"];

export default function ReportDialog({ tool, onSubmit, onClose }) {
  const dialog = useRef(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [message, setMessage] = useState("");
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
    const text = message.trim();
    const combined = text ? `${reason}：${text}` : reason;
    try {
      await onSubmit(tool.id, tool.title, combined.slice(0, 300));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="login-dialog glass-panel"
      aria-labelledby="report-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <span className="eyebrow">REPORT / 回報</span>
          <button
            type="button"
            className="quiet-button"
            aria-label="關閉回報"
            disabled={busy}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <h2 id="report-title">回報「{tool.title}」</h2>
        <p>發現連結失效或資料有誤？簡單話我們知，管理員會盡快跟進。</p>
        <label className="dialog-label">
          類別
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="dialog-label">
          補充（選填，最多 300 字）
          <textarea
            rows={3}
            maxLength={300}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? "正在送出…" : "送出回報 →"}
        </button>
        <p className="dialog-note">回報只會記錄工具編號及你輸入的內容。</p>
      </form>
    </dialog>
  );
}

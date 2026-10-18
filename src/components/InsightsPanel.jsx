import React, { useCallback, useEffect, useState } from "react";

function toolTitle(apps, id) {
  return apps.find((app) => app.id === id)?.title ?? id;
}

export default function InsightsPanel({
  apps,
  onLoadStats,
  onLoadReports,
  onDeleteReport,
}) {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [nextStats, nextReports] = await Promise.all([
        onLoadStats(),
        onLoadReports(),
      ]);
      setStats(nextStats);
      setReports(nextReports);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [onLoadStats, onLoadReports]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  async function remove(id) {
    setBusy(true);
    setError("");
    try {
      await onDeleteReport(id);
      await refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  const totals = stats?.totals ?? [];
  const max = Math.max(1, ...totals.map((t) => t.count));
  return (
    <div className="insights-panel glass-panel" aria-label="統計及回報">
      <div className="insights-heading">
        <h2 className="display text-[16px] font-bold flex items-center gap-2">
          {"📊 "}
          {"點擊統計 · 回報收件箱"}
        </h2>
        <button
          type="button"
          className="quiet-button"
          disabled={busy}
          onClick={refresh}
        >
          {busy ? "更新中…" : "重新整理 ↻"}
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="insights-summary">
        <div>
          <span className="insights-num">{stats?.today ?? "—"}</span>
          <span className="insights-label">今日點擊</span>
        </div>
        <div>
          <span className="insights-num">{stats?.grand_total ?? "—"}</span>
          <span className="insights-label">累積點擊</span>
        </div>
        <div>
          <span className="insights-num">{reports?.total ?? "—"}</span>
          <span className="insights-label">待處理回報</span>
        </div>
      </div>
      <div className="insights-rows">
        {totals.length === 0 && (
          <p className="text-[12px] text-[var(--text-2)]">
            還未有點擊記錄。訪客點擊工具方塊後就會開始統計。
          </p>
        )}
        {totals.map((t) => (
          <div className="insights-row" key={t.tool_id}>
            <span className="insights-row-title">
              {toolTitle(apps, t.tool_id)}
            </span>
            <span className="insights-bar-track">
              <span
                className="insights-bar"
                style={{ width: `${Math.round((t.count / max) * 100)}%` }}
              />
            </span>
            <span className="insights-count mono">{t.count}</span>
          </div>
        ))}
      </div>
      <h3 className="text-[13px] font-bold mt-5 mb-2">{"回報"}</h3>
      <div className="insights-rows">
        {(reports?.reports ?? []).length === 0 && (
          <p className="text-[12px] text-[var(--text-2)]">
            沒有待處理的回報。
          </p>
        )}
        {(reports?.reports ?? []).map((r) => (
          <div className="report-row" key={r.id}>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold truncate">
                {r.tool_title || toolTitle(apps, r.tool_id)}
              </div>
              <div className="text-[12px] text-[var(--text-2)] break-words">
                {r.message || "（無補充內容）"}
              </div>
              <div className="text-[10px] text-[var(--text-3)] mono">
                {String(r.created_at).replace("T", " ").slice(0, 16)}
              </div>
            </div>
            <button
              type="button"
              className="quiet-button"
              disabled={busy}
              onClick={() => remove(r.id)}
              aria-label="刪除該則回報"
            >
              刪除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

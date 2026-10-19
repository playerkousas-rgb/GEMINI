import * as React from "react";

// Back-office list: every CANVAS with its LINK and description, editable
// via the top form. Visitors never see this screen or the link text.
export default function AdminTable({
  apps,
  busy,
  editingId,
  onEdit,
  onDelete,
  onMove,
  onToggleVisible,
  onToggleShowDesc,
}) {
  const [copiedId, setCopiedId] = React.useState(null);
  const copyLink = async (event, app) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(app.url);
      setCopiedId(app.id);
      setTimeout(
        () => setCopiedId((current) => (current === app.id ? null : current)),
        1500,
      );
    } catch {
      /* Clipboard blocked by the browser; the URL text is still visible. */
    }
  };
  if (apps.length === 0) {
    return (
      <div className="admin-row admin-row-empty">
        仲未有 CANVAS，喺上面表單加第一個工具。
      </div>
    );
  }
  return (
    <div className="admin-table" role="list" aria-label="CANVAS 工具清單">
      <div className="admin-row admin-row-head" aria-hidden="true">
        <span className="admin-order" />
        <span className="min-w-0 flex-1">CANVAS · LINK · 介紹</span>
        <span className="admin-head-hint">撳任何一行即可編輯</span>
      </div>
      {apps.map((app, index) => {
        const isEditing = app.id === editingId;
        return (
          <div
            key={app.id}
            role="listitem"
            className={`admin-row ${isEditing ? "admin-row-active" : ""}`}
            onClick={() => onEdit(app)}
          >
            <div className="admin-order">
              <button
                type="button"
                disabled={busy || index === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  onMove(index, -1);
                }}
                aria-label={`將 ${app.title} 向前移`}
              >
                {"↑"}
              </button>
              <button
                type="button"
                disabled={busy || index === apps.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  onMove(index, 1);
                }}
                aria-label={`將 ${app.title} 向後移`}
              >
                {"↓"}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[18px] leading-none">{app.emoji}</span>
                <span className="text-[14px] font-bold truncate">
                  {app.title}
                </span>
                <span className="admin-chip">{app.category}</span>
                {!app.visible && (
                  <span className="admin-chip admin-chip-hidden">已隱藏</span>
                )}
                {isEditing && (
                  <span className="admin-chip admin-chip-active">編輯中</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 min-w-0">
                <span className="admin-field-label">LINK</span>
                <span className="mono text-[11px] text-[var(--text-2)] truncate">
                  {app.url}
                </span>
                <button
                  type="button"
                  className="admin-copy"
                  onClick={(event) => copyLink(event, app)}
                >
                  {copiedId === app.id ? "已複製 ✓" : "複製"}
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1 min-w-0">
                <span className="admin-field-label">介紹</span>
                <span className="text-[12px] text-[var(--text-2)] truncate">
                  {app.desc || "（空）"}
                </span>
                {app.showDesc ? (
                  <span className="admin-chip admin-chip-on">訪客看得到</span>
                ) : (
                  <span className="admin-chip">只限後台</span>
                )}
              </div>
            </div>
            <div
              className="admin-actions"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={`mini-switch ${app.visible ? "on" : ""}`}
                disabled={busy}
                aria-pressed={app.visible}
                onClick={() => onToggleVisible(app.id)}
              >
                <span className="mini-switch-dot" />
                {app.visible ? "公開" : "隱藏"}
              </button>
              <button
                type="button"
                className={`mini-switch ${app.showDesc ? "on" : ""}`}
                disabled={busy}
                aria-pressed={app.showDesc}
                onClick={() => onToggleShowDesc(app.id)}
              >
                <span className="mini-switch-dot" />
                介紹公開
              </button>
              <button
                type="button"
                className="admin-icon-btn"
                disabled={busy}
                onClick={() => onEdit(app)}
                aria-label={`編輯 ${app.title}`}
              >
                {"✎"}
              </button>
              <button
                type="button"
                className="admin-icon-btn admin-icon-danger"
                disabled={busy}
                onClick={() => onDelete(app.id)}
                aria-label={`刪除 ${app.title}`}
              >
                {"✕"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

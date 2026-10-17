import { Fragment } from "react";
import * as React from "react";
import { validateApps, isSafeToolUrl } from "./catalog.js";
import LoginDialog from "./components/LoginDialog.jsx";
const EMOJIS = [
    "\uD83D\uDEE0️",
    "\uD83C\uDFA8",
    "\uD83C\uDCCF",
    "\uD83D\uDDE3️",
    "\uD83D\uDCDD",
    "\uD83D\uDD22",
    "\uD83E\uDDE0",
    "\uD83D\uDCDA",
    "\uD83C\uDFAE",
    "\uD83C\uDFB5",
    "\uD83C\uDF08",
    "✂️",
    "\uD83E\uDDE9",
    "\uD83D\uDCA1",
    "\uD83D\uDE80",
    "\uD83D\uDCCA",
    "\uD83D\uDDBC️",
    "\uD83C\uDFAF",
    "\uD83C\uDF3F",
    "✨",
    "\uD83D\uDD25",
    "\uD83C\uDF80",
  ],
  CATEGORIES = ["全部", "創作", "教學", "輔導", "工具", "遊戲"];
export default function App({
  apps,
  canEdit,
  mode,
  busy,
  notice,
  onSave,
  onLogin,
  onLogout,
  onNotice,
}) {
  let [query, setQuery] = React.useState(""),
    [category, setCategory] = React.useState("全部"),
    [isEditing, setIsEditing] = React.useState(false),
    [showLogin, setShowLogin] = React.useState(false),
    [editingId, setEditingId] = React.useState(null),
    [showExport, setShowExport] = React.useState(false),
    [copied, setCopied] = React.useState(false),
    [importText, setImportText] = React.useState(""),
    [showImport, setShowImport] = React.useState(false),
    [refreshKey, setRefreshKey] = React.useState(0),
    [pointer, setPointer] = React.useState({
      x: 0,
      y: 0,
    }),
    [confettiKey, setConfettiKey] = React.useState(0),
    [confetti, setConfetti] = React.useState([]),
    [ripples, setRipples] = React.useState([]),
    [isHovered, setIsHovered] = React.useState(false),
    [form, setForm] = React.useState({
      title: "",
      desc: "",
      url: "",
      emoji: "\uD83D\uDEE0️",
      category: "工具",
      visible: true,
    }),
    editorRef = React.useRef(null),
    searchRef = React.useRef(null),
    heroRef = React.useRef(null);
  React.useEffect(() => {
    if (!canEdit) setIsEditing(false);
  }, [canEdit]);
  const hasUnsavedInput = Boolean(form.title || form.desc || form.url);
  React.useEffect(() => {
    if (!isEditing || !hasUnsavedInput) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isEditing, hasUnsavedInput]);
  const closeLogin = () => {
    setShowLogin(false);
    history.replaceState(null, "", "/");
  };
  const enterEditor = async (email, password) => {
    await onLogin(email, password);
    setIsEditing(true);
    setShowLogin(false);
    history.replaceState(null, "", "/edit");
  };
  (React.useEffect(() => {
    let w = (T) => {
      let A = (T.clientX / window.innerWidth - 0.5) * 2,
        fe = (T.clientY / window.innerHeight - 0.5) * 2;
      setPointer({
        x: A,
        y: fe,
      });
    };
    return (
      window.addEventListener("mousemove", w, {
        passive: true,
      }),
      () => window.removeEventListener("mousemove", w)
    );
  }, []),
    React.useEffect(() => {
      let w = () => {
        if (
          (["#edit", "#admin"].includes(window.location.hash.toLowerCase()) ||
            /^\/edit\/?$/.test(window.location.pathname)) &&
          !isEditing
        )
          setShowLogin(true);
      };
      return (
        w(),
        window.addEventListener("hashchange", w),
        window.addEventListener("popstate", w),
        () => {
          window.removeEventListener("hashchange", w);
          window.removeEventListener("popstate", w);
        }
      );
    }, [isEditing]));
  let filteredApps = React.useMemo(() => {
      return apps.filter((w) => {
        let T =
            !query ||
            w.title.toLowerCase().includes(query.toLowerCase()) ||
            w.desc.toLowerCase().includes(query.toLowerCase()) ||
            w.emoji.includes(query),
          A = category === "全部" || w.category === category;
        return T && A && (isEditing || w.visible);
      });
    }, [apps, query, category, isEditing]),
    celebrate = () => {
      let w = Array.from(
        {
          length: 18,
        },
        () => ({
          x: Math.random() * 100,
          y: Math.random() * 20 + 50,
        }),
      );
      (setConfetti(w),
        setConfettiKey((T) => T + 1),
        setTimeout(() => setConfetti([]), 1200));
    },
    saveTool = async () => {
      if (busy) return;
      const tool = {
        ...form,
        title: form.title.trim(),
        desc: form.desc.trim(),
        url: form.url.trim(),
        id: editingId || crypto.randomUUID(),
      };
      if (!tool.title || !tool.desc || !tool.url) {
        onNotice("請填寫工具名稱、介紹及 Share Link。");
        return;
      }
      if (!isSafeToolUrl(tool.url)) {
        onNotice("請使用有效的 https:// 分享網址。");
        return;
      }
      if (editingId && !apps.some((app) => app.id === editingId)) {
        onNotice("此工具已不存在，請取消編輯後重新新增。");
        return;
      }
      if (apps.some((app) => app.id !== tool.id && app.url === tool.url)) {
        onNotice("這條連結已在清單中，請編輯原有方塊，避免重複新增。");
        return;
      }
      const next = editingId
        ? apps.map((app) => (app.id === editingId ? tool : app))
        : [tool, ...apps];
      if (await onSave(next)) {
        setEditingId(null);
        setForm({
          title: "",
          desc: "",
          url: "",
          emoji: "🛠️",
          category: "工具",
          visible: true,
        });
        setQuery("");
        setCategory("全部");
        celebrate();
      }
    },
    editTool = (w) => {
      (setForm({
        title: w.title,
        desc: w.desc,
        url: w.url,
        emoji: w.emoji,
        category: w.category,
        visible: w.visible,
      }),
        setEditingId(w.id),
        editorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }));
    },
    deleteTool = async (id) => {
      if (busy || !confirm("確定刪除這個工具？此操作會立即儲存。")) return;
      if (await onSave(apps.filter((app) => app.id !== id))) {
        if (editingId === id) setEditingId(null);
      }
    },
    moveTool = async (index, offset) => {
      if (busy) return;
      const next = [...apps],
        target = index + offset;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      await onSave(next);
    },
    toggleVisible = async (id) => {
      if (!busy)
        await onSave(
          apps.map((app) =>
            app.id === id ? { ...app, visible: !app.visible } : app,
          ),
        );
    },
    exportJson = React.useMemo(() => JSON.stringify(apps, null, 2), [apps]),
    copyJson = async () => {
      try {
        await navigator.clipboard.writeText(exportJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        alert("複製失敗，請手動複製或下載 JSON。");
      }
    },
    importJson = async () => {
      if (busy) return;
      try {
        let w = JSON.parse(importText);
        w = validateApps(w);
        if (
          !confirm(
            `匯入會取代目前全部 ${apps.filter((app) => isEditing || app.visible).length} 個工具，改為 ${w.length} 個。建議先下載備份。確定繼續？`,
          )
        )
          return;
        if (await onSave(w)) {
          setShowImport(false);
          setImportText("");
          setEditingId(null);
          celebrate();
        }
      } catch (error) {
        onNotice(`匯入失敗：${error.message}`);
      }
    },
    exitEditor = async () => {
      if (busy) return;
      if (hasUnsavedInput && !confirm("表單有未儲存的內容，確定離開編輯？"))
        return;
      if (!(await onLogout())) return;
      setIsEditing(false);
      setEditingId(null);
      setForm({
        title: "",
        desc: "",
        url: "",
        emoji: "🛠️",
        category: "工具",
        visible: true,
      });
      setShowExport(false);
      setShowImport(false);
      setImportText("");
      history.replaceState(null, "", "/");
    },
    addRipple = (w) => {
      let T = w.currentTarget.getBoundingClientRect(),
        A = w.clientX - T.left,
        fe = w.clientY - T.top,
        wo = Date.now() + Math.random();
      (setRipples((Vl) => [
        ...Vl,
        {
          id: wo,
          x: A,
          y: fe,
        },
      ]),
        setTimeout(
          () => setRipples((Vl) => Vl.filter((kf) => kf.id !== wo)),
          700,
        ));
    };
  return (
    <div className="min-h-screen w-full text-[var(--text)] selection:bg-[#111] selection:text-white overflow-x-clip">
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden={true}>
        <div
          className="absolute inset-0"
          style={{
            background: `
            radial-gradient(1200px 600px at 15% -10%, rgba(214,242,100,0.28), transparent 60%),
            radial-gradient(900px 600px at 90% 0%, rgba(194,232,160,0.32), transparent 55%),
            radial-gradient(1000px 800px at 50% 120%, rgba(246,243,237,1), transparent 70%),
            linear-gradient(180deg, #FDFCF8 0%, #F7F5EF 35%, #EFF6E8 100%)
          `,
          }}
        />
        <div
          className="absolute w-[520px] h-[520px] rounded-full blur-[1px] opacity-60 animate-float"
          style={{
            left: "8%",
            top: "8%",
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(214,242,100,0.42) 45%, rgba(214,242,100,0.08) 75%)",
            filter: "blur(26px)",
            transform: `translate3d(${pointer.x * 18}px, ${pointer.y * 12}px, 0)`,
            transition: "transform 0.8s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
        <div
          className="absolute w-[680px] h-[680px] rounded-full opacity-50 animate-float2"
          style={{
            right: "-8%",
            top: "-6%",
            background:
              "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.9), rgba(194,232,160,0.38) 40%, rgba(194,232,160,0.06) 70%)",
            filter: "blur(32px)",
            transform: `translate3d(${pointer.x * -22}px, ${pointer.y * 16}px, 0)`,
            transition: "transform 0.9s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
        <div
          className="absolute w-[420px] h-[420px] rounded-full opacity-40 animate-float"
          style={{
            left: "45%",
            top: "42%",
            background:
              "radial-gradient(circle at 40% 40%, rgba(255,255,255,0.9), rgba(255,232,120,0.28) 50%, transparent 70%)",
            filter: "blur(28px)",
            transform: `translate3d(${pointer.x * 12}px, ${pointer.y * -10}px, 0)`,
            transition: "transform 1s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>
      {confetti.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
          {confetti.map((w, T) => (
            <div
              className="absolute animate-confetti select-none"
              style={{
                left: `${w.x}%`,
                top: `${w.y}%`,
                animationDelay: `${T * 0.04}s`,
                fontSize: `${14 + Math.random() * 12}px`,
              }}
              key={`${confettiKey}-${T}`}
            >
              {
                [
                  "✨",
                  "\uD83C\uDF3F",
                  "\uD83D\uDCAB",
                  "\uD83C\uDF89",
                  "\uD83C\uDF43",
                ][T % 5]
              }
            </div>
          ))}
        </div>
      )}
      <div
        className="w-full min-h-screen flex flex-col relative"
        style={{
          paddingTop: "var(--safe-area-inset-top)",
          boxSizing: "border-box",
        }}
      >
        <header
          className="sticky top-0 z-30 border-b border-white/60 backdrop-blur-2xl"
          style={{
            top: "var(--safe-area-inset-top)",
            background:
              "linear-gradient(180deg, rgba(253,252,248,0.92), rgba(253,252,248,0.68))",
            backdropFilter: "blur(24px) saturate(1.2)",
          }}
        >
          <div className="hub-header max-w-[1320px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className="w-11 h-11 rounded-[14px] bg-[#141413] text-white flex items-center justify-center font-extrabold text-[18px] tracking-tight shadow-[0_8px_20px_rgba(0,0,0,0.16)] animate-float"
                  style={{
                    animationDuration: "4.5s",
                  }}
                >
                  {"N"}
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#D6F264] shadow-[0_0_0_3px_white] animate-[glowPulse_2s_ease-in-out_infinite]" />
                </div>
              </div>
              <div>
                <h1 className="display text-[18px] sm:text-[19px] font-bold leading-none tracking-tight flex items-center gap-2">
                  {"NoScout Tools Hub"}
                  <span className="hidden sm:inline-flex text-[10px] font-medium tracking-[0.12em] px-2 py-1 rounded-full bg-[#141413] text-white translate-y-[1px]">
                    {"SCOUT EDITION"}
                  </span>
                </h1>
                <p className="text-[12px] text-[var(--text-2)] mt-1 flex items-center gap-2">
                  <span>{"一格一Link · 全部 Gemini Canvas 工具放晒呢度"}</span>
                  <span className="w-1 h-1 rounded-full bg-[var(--text-3)] hidden sm:block" />
                  <span className="hidden sm:inline text-[11px]">
                    {"你的工具，集中一處"}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden md:flex items-center gap-2 mr-1">
                <span className="text-[10px] tracking-widest font-medium px-2.5 py-1.5 rounded-full bg-white/80 border border-white shadow-sm mono">
                  {mode === "local" ? "LOCAL PREVIEW" : "CLOUD CONNECTED"}
                </span>
                <span
                  className="w-7 h-7 rounded-full bg-white border border-white shadow-sm grid place-items-center text-[12px] animate-float"
                  style={{
                    animationDelay: "0.6s",
                  }}
                >
                  {"\uD83C\uDF3F"}
                </span>
              </div>
              {!isEditing ? (
                <button
                  onClick={() => setShowLogin(true)}
                  className="btn-press h-[38px] px-4 rounded-full bg-white/90 border border-white text-[13px] font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] hover:bg-white transition-all flex items-center gap-1.5"
                >
                  <span>{"\uD83D\uDD10"}</span>
                  {" EDIT · 管理入口"}
                </button>
              ) : (
                <Fragment>
                  <span className="hidden sm:inline-flex h-[36px] px-3 rounded-full bg-[#141413] text-white text-[12px] items-center gap-2 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-[#D6F264] animate-pulse shadow-[0_0_8px_#D6F264]" />
                    {" 編輯模式"}
                  </span>
                  <button
                    disabled={busy}
                    onClick={exitEditor}
                    className="btn-press h-[38px] px-4 rounded-full bg-[#141413] text-white text-[13px] font-semibold shadow-lg hover:opacity-[0.9] transition-all"
                  >
                    {mode === "cloud" ? "登出管理" : "退出試用"}
                  </button>
                </Fragment>
              )}
            </div>
          </div>
        </header>
        <section
          className={`connection-banner ${mode}`}
          aria-label="儲存連線狀態"
        >
          <span className="connection-dot" />
          <div>
            <strong>
              {mode === "local" ? "本機試用 · 尚未連接 Supabase" : "雲端入口"}
            </strong>
            <span>
              {mode === "local"
                ? "內容只存在這個瀏覽器，未公開發布。清除網站資料或結束無痕工作階段可能遺失，請下載備份。"
                : "工具清單由雲端讀取；只有管理員可以修改。"}
            </span>
          </div>
          {!isEditing && (
            <button className="quiet-button" onClick={() => setShowLogin(true)}>
              EDIT ↗
            </button>
          )}
        </section>
        {notice && (
          <div
            className={`save-notice ${notice.type}`}
            role={notice.type === "error" ? "alert" : "status"}
          >
            {notice.text}
          </div>
        )}
        {busy && (
          <div className="saving-indicator" role="status">
            正在儲存，請稍候…
          </div>
        )}
        {isEditing && (
          <div
            ref={editorRef}
            className="max-w-[1320px] mx-auto w-full px-5 sm:px-8 pt-7 pb-2 animate-slideDown"
          >
            <div className="glass-panel p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute -top-[120px] -right-[120px] w-[260px] h-[260px] rounded-full bg-gradient-to-br from-[#D6F264]/30 to-[#C2E8A0]/20 blur-[20px] pointer-events-none" />
              <div className="flex flex-wrap items-start justify-between gap-4 mb-7 relative">
                <div>
                  <h2 className="display text-[20px] font-bold flex items-center gap-2">
                    <span className="w-8 h-8 rounded-[10px] bg-[#141413] text-white grid place-items-center text-[14px]">
                      {"✦"}
                    </span>
                    {"加新工具 · 開一格方磚"}
                  </h2>
                  <p className="text-[13px] text-[var(--text-2)] mt-2 leading-[1.6] max-w-[54ch]">
                    {mode === "local"
                      ? "填好名稱、介紹及 Share Link，儲存後立即產生方塊。目前只儲存到本機，未公開發布。"
                      : "填好名稱、介紹及 Share Link，按儲存即可發布。不用修改程式碼，也不用重新部署。"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowImport(!showImport)}
                    className="btn-press h-9 px-4 rounded-full bg-[#F6F3ED] border border-[var(--border-soft)] text-[12px] font-medium hover:bg-white transition-colors"
                  >
                    {"匯入 JSON"}
                  </button>
                  <button
                    onClick={() => setShowExport(!showExport)}
                    className="btn-press h-9 px-4 rounded-full bg-[#141413] text-white text-[12px] font-medium shadow-md"
                  >
                    {showExport ? "收起" : "導出 JSON"}
                  </button>
                  <button
                    className="btn-press h-9 px-4 rounded-full bg-white border text-[12px]"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([exportJson], {
                          type: "application/json",
                        }),
                      );
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "apps.json";
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    {"下載 JSON"}
                  </button>
                </div>
              </div>
              <fieldset
                disabled={busy}
                className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-7 editor-fields"
              >
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block group">
                      <span className="text-[11px] font-semibold tracking-wide text-[var(--text-2)]">
                        {"工具名稱 *"}
                      </span>
                      <div className="relative mt-2 focus-glow rounded-[14px] border border-[var(--border-soft)] bg-[#FBFAF7] transition-all">
                        <input
                          maxLength={100}
                          value={form.title}
                          onChange={(w) =>
                            setForm((T) => ({
                              ...T,
                              title: w.target.value,
                            }))
                          }
                          placeholder="例如：四格漫畫生成器"
                          className="w-full h-[46px] px-4 rounded-[14px] bg-transparent outline-none text-[14px] font-medium"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold tracking-wide text-[var(--text-2)]">
                        {"分類"}
                      </span>
                      <div className="mt-2">
                        <select
                          value={form.category}
                          onChange={(w) =>
                            setForm((T) => ({
                              ...T,
                              category: w.target.value,
                            }))
                          }
                          className="w-full h-[46px] px-4 rounded-[14px] border border-[var(--border-soft)] bg-[#FBFAF7] outline-none text-[14px] focus:border-[#141413] focus:bg-white transition-colors"
                        >
                          {CATEGORIES.filter((w) => w !== "全部").map((w) => (
                            <option key={w}>{w}</option>
                          ))}
                        </select>
                      </div>
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-[11px] font-semibold tracking-wide text-[var(--text-2)]">
                      {"Share Link *（https:// 分享網址）"}
                    </span>
                    <div className="mt-2 focus-glow rounded-[14px] border border-[var(--border-soft)] bg-[#FBFAF7] transition-all flex items-center">
                      <span className="pl-4 text-[11px] text-[var(--text-3)] mono">
                        {"LINK"}
                      </span>
                      <input
                        maxLength={2048}
                        type="url"
                        value={form.url}
                        onChange={(w) =>
                          setForm((T) => ({
                            ...T,
                            url: w.target.value,
                          }))
                        }
                        placeholder="https://share.gemini.google/..."
                        className="flex-1 h-[46px] px-3 rounded-[14px] bg-transparent outline-none text-[14px] mono font-medium"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold tracking-wide text-[var(--text-2)]">
                      {"介紹 *（限 90 字）"}
                    </span>
                    <div className="mt-2 focus-glow rounded-[14px] border border-[var(--border-soft)] bg-[#FBFAF7] transition-all">
                      <textarea
                        value={form.desc}
                        onChange={(w) =>
                          setForm((T) => ({
                            ...T,
                            desc: w.target.value.slice(0, 90),
                          }))
                        }
                        rows={2}
                        placeholder="講下呢個工具幫到咩手..."
                        className="w-full px-4 py-3 rounded-[14px] bg-transparent outline-none text-[14px] resize-none"
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[11px] text-[var(--text-3)] mono">
                        {"寫得有心，細路更易明"}
                      </span>
                      <span
                        className={`text-[11px] mono px-2 py-0.5 rounded-full ${form.desc.length > 80 ? "bg-[#FFE8E8] text-[#B42318]" : "bg-white border text-[var(--text-2)]"}`}
                      >
                        {form.desc.length}
                        {"/90"}
                      </span>
                    </div>
                  </label>
                  <div>
                    <span className="text-[11px] font-semibold tracking-wide text-[var(--text-2)]">
                      {"揀個 Emoji Icon · 32px 大粒粒"}
                    </span>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {EMOJIS.map((w) => (
                        <button
                          onClick={() =>
                            setForm((T) => ({
                              ...T,
                              emoji: w,
                            }))
                          }
                          className={`btn-press w-11 h-11 rounded-[12px] border flex items-center justify-center text-[22px] transition-all ${form.emoji === w ? "bg-[#141413] border-[#141413] scale-[1.08] shadow-[0_8px_20px_rgba(0,0,0,0.18)]" : "bg-white border-[var(--border-soft)] hover:scale-[1.08] hover:shadow-md"}`}
                          key={w}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="visibility-toggle">
                    <input
                      type="checkbox"
                      checked={form.visible}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          visible: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      公開顯示
                      <small>
                        {mode === "local"
                          ? "本機預覽開關，並非公開發布"
                          : "取消勾選後，訪客不會看到此工具"}
                      </small>
                    </span>
                  </label>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={saveTool}
                      className="btn-press group relative overflow-hidden h-[46px] px-7 rounded-[14px] bg-[#141413] text-white text-[14px] font-semibold hover:opacity-[0.92] transition-all shadow-[0_10px_24px_rgba(0,0,0,0.18)] flex items-center gap-2"
                    >
                      <span className="relative z-10">
                        {busy
                          ? "正在儲存…"
                          : editingId
                            ? "儲存修改 ✓"
                            : mode === "local"
                              ? "新增方塊（本機）＋"
                              : "新增並儲存 ＋"}
                      </span>
                      <span
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background:
                            "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
                          backgroundSize: "200% 100%",
                          animation: "shimmer 1.6s linear infinite",
                        }}
                      />
                    </button>
                    {editingId && (
                      <button
                        onClick={() => {
                          (setEditingId(null),
                            setForm({
                              title: "",
                              desc: "",
                              url: "",
                              emoji: "\uD83D\uDEE0️",
                              category: "工具",
                              visible: true,
                            }));
                        }}
                        className="btn-press h-[46px] px-5 rounded-[14px] bg-white border border-[var(--border-soft)] text-[14px] font-medium"
                      >
                        {"取消編輯"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-[rgba(246,243,237,0.6)] rounded-[18px] border border-dashed border-[rgba(20,20,19,0.12)] p-4 backdrop-blur">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold tracking-wide">
                      {"即時預覽 · Glass 磚仔"}
                    </span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-white border border-white shadow-sm animate-float">
                      {"LIVE PREVIEW"}
                    </span>
                  </div>
                  <div className="glass-tile p-6 !shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
                    <div className="w-12 h-12 rounded-[14px] bg-white border border-white shadow-sm flex items-center justify-center text-[26px] mb-5 animate-float">
                      {form.emoji || "\uD83D\uDEE0️"}
                    </div>
                    <h3 className="font-bold text-[17px] leading-tight">
                      {form.title || "未命名工具"}
                    </h3>
                    <p className="text-[13px] text-[var(--text-2)] mt-2.5 leading-[1.6] line-clamp-2">
                      {form.desc ||
                        "簡介會顯示喺呢度，幫人快啲明咩嚟。寫得靚啲會更想撳入去。"}
                    </p>
                    <div className="mt-5 flex items-center gap-2">
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-white shadow-sm">
                        {form.category}
                      </span>
                      <span className="text-[11px] text-[var(--text-2)] mono truncate">
                        {form.url.slice(0, 26)}
                        {"…"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 text-[11px] leading-[1.6] text-[var(--text-2)] mono bg-white/80 backdrop-blur p-3.5 rounded-[14px] border border-white shadow-sm">
                    <div className="font-bold text-[#111] mb-1 flex items-center gap-1.5">
                      <span>{"⚡"}</span>
                      {" 儲存方式"}
                    </div>
                    {mode === "local"
                      ? "本機試用：新增後會保存到這個瀏覽器，重新整理仍可看到。接上 Supabase 後，可在管理頁匯入備份，不會自動上傳本機草稿。"
                      : "雲端模式：儲存成功後才會更新方塊；網絡中斷會顯示錯誤，表單內容會保留。"}
                  </div>
                </div>
              </fieldset>
              {showImport && (
                <div className="mt-7 p-5 rounded-[16px] bg-[#FFFBE6] border border-[#F5E6A0] animate-slideDown">
                  <div className="text-[13px] font-bold mb-3 flex items-center gap-2">
                    {"\uD83D\uDCE5 匯入 apps.json"}
                  </div>
                  <textarea
                    value={importText}
                    aria-label="匯入工具 JSON"
                    onChange={(w) => setImportText(w.target.value)}
                    placeholder='貼上 [{"title":...}]'
                    className="w-full h-28 p-3.5 rounded-[12px] border border-[#E8D98A] mono text-[12px] bg-white focus:border-[#141413] outline-none transition-colors"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      disabled={busy}
                      onClick={importJson}
                      className="btn-press h-9 px-5 rounded-full bg-[#111] text-white text-[12px] font-medium"
                    >
                      {"確認匯入 ✨"}
                    </button>
                    <button
                      onClick={() => setShowImport(false)}
                      className="btn-press h-9 px-5 rounded-full bg-white border text-[12px]"
                    >
                      {"取消"}
                    </button>
                  </div>
                </div>
              )}
              {showExport && (
                <div className="mt-7 animate-slideDown">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-bold">
                      {"工具清單備份"}
                    </span>
                    <button
                      onClick={copyJson}
                      className="btn-press h-9 px-5 rounded-full bg-[#111] text-white text-[12px] font-medium shadow-md"
                    >
                      {copied ? "已複製 ✓ 係咪好爽？" : "一鍵複製"}
                    </button>
                  </div>
                  <pre
                    ref={searchRef}
                    className="w-full max-h-[280px] overflow-auto p-5 rounded-[16px] bg-[#141413] text-[#EDE9DF] mono text-[11px] leading-[1.7] border border-[#222] shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
                  >
                    {exportJson}
                  </pre>
                  <p className="text-[11px] text-[var(--text-2)] mt-3">
                    {
                      "JSON 只用作備份及搬移資料。日常新增、修改和排序只需按儲存，不用操作 GitHub。"
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        <main className="max-w-[1320px] mx-auto w-full px-5 sm:px-8 py-10 flex-1">
          <div
            ref={heroRef}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10"
          >
            <div className="animate-fadeInUp">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-white shadow-sm text-[11px] font-medium mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
                {"教學、創作、輔導 · 一個入口"}
                <span className="px-1.5 py-0.5 rounded-full bg-[#D6F264] text-[#111] text-[10px] ml-1">
                  {"GEMINI TOOLS"}
                </span>
              </div>
              <h2 className="display text-[36px] sm:text-[52px] font-[800] tracking-[-0.04em] leading-[0.88]">
                <span
                  className="inline-block animate-fadeInUp"
                  style={{
                    animationDelay: "0.05s",
                  }}
                >
                  {"將你嘅"}
                </span>
                <br />
                <span
                  className="inline-block animate-fadeInUp relative"
                  style={{
                    animationDelay: "0.12s",
                  }}
                >
                  {"Gemini Canvas"}
                  <span className="absolute -top-2 -right-6 text-[16px] animate-float hidden sm:block">
                    {"✨"}
                  </span>
                </span>
                <br />
                <span
                  className="inline-block animate-fadeInUp bg-gradient-to-r from-[#141413] via-[#3A5A24] to-[#7AAE3A] bg-clip-text text-transparent"
                  style={{
                    animationDelay: "0.19s",
                  }}
                >
                  {"工具一格格收好"}
                </span>
              </h2>
              <p
                className="text-[14px] sm:text-[15px] text-[var(--text-2)] mt-5 max-w-[46ch] leading-[1.7] animate-fadeInUp"
                style={{
                  animationDelay: "0.26s",
                }}
              >
                <b className="text-[#141413] font-semibold">
                  {"一格一個工具，一按就開啟。"}
                </b>
                {
                  "把 Gemini Share Link 集中收好，透過 EDIT 輕鬆管理名稱、介紹和分類。連結是否需要登入，仍由 Gemini 的分享設定決定。"
                }
              </p>
              <div
                className="flex items-center gap-2 mt-6 animate-fadeInUp"
                style={{
                  animationDelay: "0.32s",
                }}
              >
                <div className="flex -space-x-2">
                  {["\uD83C\uDFA8", "\uD83C\uDCCF", "\uD83C\uDF08"].map(
                    (w, T) => (
                      <div
                        className="w-8 h-8 rounded-full bg-white border-2 border-white shadow-md grid place-items-center text-[14px]"
                        key={T}
                      >
                        {w}
                      </div>
                    ),
                  )}
                </div>
                <span className="text-[12px] text-[var(--text-2)]">
                  {"已經有 "}
                  {apps.filter((app) => isEditing || app.visible).length}
                  {" 格靚磚，等你嚟篩"}
                </span>
              </div>
            </div>
            <div
              className="w-full lg:w-[380px] animate-fadeInUp"
              style={{
                animationDelay: "0.22s",
              }}
            >
              <div
                className={`relative group rounded-[18px] border bg-white/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition-all duration-500 ${isHovered ? "ring-[3px] ring-[#D6F264]/60 border-[#141413] shadow-[0_16px_40px_rgba(0,0,0,0.12)] scale-[1.01]" : "border-white hover:border-[rgba(0,0,0,0.08)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)]"}`}
              >
                <span
                  className={`absolute left-4 top-1/2 -translate-y-1/2 text-[16px] transition-all duration-300 ${isHovered ? "scale-110 rotate-[-8deg]" : "opacity-60"}`}
                >
                  {"⌕"}
                </span>
                <input
                  aria-label="搜尋工具"
                  value={query}
                  onChange={(w) => setQuery(w.target.value)}
                  onFocus={() => setIsHovered(true)}
                  onBlur={() => setIsHovered(false)}
                  placeholder="搵工具...  例如：漫畫、詞彙、社交"
                  className="w-full h-[52px] pl-11 pr-4 rounded-[18px] bg-transparent text-[14px] font-medium outline-none placeholder:text-[var(--text-3)]"
                />
                {query && (
                  <button
                    aria-label="清除搜尋"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#141413] text-white grid place-items-center text-[12px] btn-press animate-popIn"
                  >
                    {"✕"}
                  </button>
                )}
              </div>
              <div className="flex gap-2 mt-4 flex-wrap">
                {CATEGORIES.map((w) => (
                  <button
                    onClick={() => {
                      (setCategory(w), setRefreshKey((T) => T + 1));
                    }}
                    className={`btn-press h-9 px-4 rounded-full text-[12px] font-semibold border backdrop-blur transition-all duration-300 ${category === w ? "pill-active" : "bg-white/80 border-white text-[var(--text-2)] hover:bg-white hover:border-[#141413]/10 hover:text-[#141413] hover:shadow-md hover:-translate-y-[1px]"}`}
                    aria-pressed={category === w}
                    key={w}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--text-3)] mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D6F264]" />
                {"焦點發光動畫 · Pill 變形 · 滑鼠視差光球"}
              </div>
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-2.5 mb-8 animate-fadeInUp"
            style={{
              animationDelay: "0.36s",
            }}
          >
            <span className="px-3 py-1.5 rounded-full bg-white/80 border border-white shadow-sm text-[11px] font-medium backdrop-blur">
              {"共 "}
              {apps.filter((app) => isEditing || app.visible).length}
              {" 格工具"}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[#141413] text-white text-[11px] font-medium shadow-md">
              {"篩選到 "}
              {filteredApps.length}
              {" 格"}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white/60 border border-white text-[11px] mono opacity-70">
              {"操作 "}
              {refreshKey}
              {" · 保持輕盈"}
            </span>
            {isEditing && (
              <span className="px-3 py-1.5 rounded-full bg-[#FFF4C2] border border-[#F5E6A0] text-[#111] text-[11px] font-medium animate-[glowPulse_2s_ease-in-out_infinite]">
                {"編輯中：用 ↑ ↓ 排序並儲存"}
              </span>
            )}
            <span className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-[var(--text-3)]">
              <span>{"滾動視差已啟用"}</span>
              <span className="w-6 h-[1px] bg-[var(--text-3)]" />
              <span>{"32px Emoji"}</span>
            </span>
          </div>
          <div
            className="grid gap-5 sm:gap-6"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            }}
          >
            {filteredApps.map((w, T) => {
              let A = apps.findIndex((fe) => fe.id === w.id);
              return (
                <div
                  className="group relative glass-tile p-6 flex flex-col min-h-[210px] overflow-hidden animate-fadeInUp"
                  style={{
                    animationDelay: `${T * 0.05 + 0.4}s`,
                  }}
                  onPointerDown={addRipple}
                  key={w.id}
                >
                  <div className="absolute inset-0 overflow-hidden rounded-[20px] pointer-events-none">
                    {ripples.map((fe) => (
                      <span
                        className="ripple"
                        style={{
                          left: fe.x - 20,
                          top: fe.y - 20,
                          width: 40,
                          height: 40,
                        }}
                        key={fe.id}
                      />
                    ))}
                  </div>
                  <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />
                  <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-gradient-to-br from-[#D6F264]/0 to-[#D6F264]/0 group-hover:from-[#D6F264]/30 group-hover:to-[#C2E8A0]/20 blur-[1px] transition-all duration-700" />
                  {isEditing && (
                    <div className="tile-admin-controls">
                      <button
                        disabled={busy || A === 0}
                        aria-label={`將 ${w.title} 向前移`}
                        onClick={() => moveTool(A, -1)}
                        className="btn-press w-8 h-8 rounded-full bg-white border border-white shadow-md text-[12px] hover:bg-[#141413] hover:text-white transition-colors"
                      >
                        {"↑"}
                      </button>
                      <button
                        disabled={busy || A === apps.length - 1}
                        aria-label={`將 ${w.title} 向後移`}
                        onClick={() => moveTool(A, 1)}
                        className="btn-press w-8 h-8 rounded-full bg-white border border-white shadow-md text-[12px] hover:bg-[#141413] hover:text-white transition-colors"
                      >
                        {"↓"}
                      </button>
                      <button
                        disabled={busy}
                        aria-label={`編輯 ${w.title}`}
                        onClick={() => editTool(w)}
                        className="btn-press w-8 h-8 rounded-full bg-white border border-white shadow-md text-[12px] hover:bg-[#141413] hover:text-white transition-colors"
                      >
                        {"✎"}
                      </button>
                      <button
                        disabled={busy}
                        aria-label={`刪除 ${w.title}`}
                        onClick={() => deleteTool(w.id)}
                        className="btn-press w-8 h-8 rounded-full bg-[#FFE8E8] border border-[#FFCFCF] shadow-sm text-[12px] hover:bg-[#FF3B30] hover:text-white transition-colors"
                      >
                        {"✕"}
                      </button>
                    </div>
                  )}
                  {isEditing && (
                    <button
                      className="visibility-pill"
                      disabled={busy}
                      onClick={() => toggleVisible(w.id)}
                      aria-label={`${w.visible ? "隱藏" : "公開"} ${w.title}`}
                    >
                      {w.visible ? "● 公開顯示" : "○ 已隱藏"}
                    </button>
                  )}
                  <div className="flex items-start justify-between relative z-[1]">
                    <div className="emoji-wrap w-[52px] h-[52px] rounded-[16px] bg-white border border-white shadow-[0_8px_20px_rgba(0,0,0,0.06),0_1px_0_white_inset] flex items-center justify-center text-[32px] transition-transform duration-500">
                      {w.emoji}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/90 border border-white shadow-sm backdrop-blur">
                        {w.category}
                      </span>
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-press w-8 h-8 rounded-full bg-[#141413] text-white flex items-center justify-center text-[12px] shadow-[0_6px_16px_rgba(0,0,0,0.16)] group-hover:rotate-[-12deg] group-hover:scale-110 transition-all duration-500"
                        aria-label="開啟工具"
                      >
                        {"↗"}
                      </a>
                    </div>
                  </div>
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 block group/title relative z-[1]"
                  >
                    <h3 className="text-[18px] font-bold leading-[1.2] tracking-tight group-hover/title:underline decoration-[1.5px] underline-offset-[6px] decoration-[#141413]/20">
                      {w.title}
                    </h3>
                  </a>
                  <p className="text-[13px] text-[var(--text-2)] mt-3 leading-[1.65] line-clamp-2 min-h-[44px] relative z-[1]">
                    {w.desc}
                  </p>
                  <div className="mt-auto pt-5 flex items-center justify-between relative z-[1]">
                    <span className="text-[11px] mono text-[var(--text-2)] truncate max-w-[160px] bg-white/70 px-2 py-1 rounded-full border border-white">
                      {w.url.replace("https://", "")}
                    </span>
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-press text-[12px] font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141413] text-white shadow-md hover:gap-2 hover:shadow-lg transition-all"
                    >
                      {"開啟 "}
                      <span className="text-[14px] group-hover:translate-x-0.5 transition-transform">
                        {"→"}
                      </span>
                    </a>
                  </div>
                  <div className="absolute left-6 right-6 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#D6F264]/0 to-transparent group-hover:via-[#D6F264]/60 transition-all duration-700" />
                </div>
              );
            })}
            {isEditing && (
              <button
                onClick={() =>
                  editorRef.current?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
                className="btn-press min-h-[210px] rounded-[20px] border-2 border-dashed border-[rgba(20,20,19,0.12)] bg-[rgba(255,255,255,0.5)] backdrop-blur flex flex-col items-center justify-center gap-3 text-[var(--text-2)] hover:border-[#141413] hover:text-[#141413] hover:bg-white/80 transition-all duration-300 group animate-fadeInUp"
                style={{
                  animationDelay: `${filteredApps.length * 0.05 + 0.5}s`,
                }}
              >
                <span className="w-12 h-12 rounded-full bg-white border border-white shadow-md flex items-center justify-center text-[20px] group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  {"＋"}
                </span>
                <span className="text-[13px] font-semibold">
                  {"新增工具方塊"}
                </span>
                <span className="text-[11px] opacity-60">
                  {"填好名稱、介紹及 Share Link"}
                </span>
              </button>
            )}
          </div>
          {filteredApps.length === 0 && (
            <div className="mt-20 text-center animate-popIn">
              <div className="inline-flex w-20 h-20 rounded-full bg-white border border-white shadow-[0_12px_32px_rgba(0,0,0,0.06)] items-center justify-center text-[28px] animate-float">
                {"∅"}
              </div>
              <p className="mt-5 text-[14px] text-[var(--text-2)]">
                {apps.length === 0
                  ? "你的工具入口準備好了，加入第一條 Share Link 吧。"
                  : "搵唔到相關工具，試下轉關鍵字或分類"}
              </p>
              <button
                onClick={() => {
                  if (apps.length === 0) {
                    if (isEditing)
                      editorRef.current?.scrollIntoView({ behavior: "smooth" });
                    else setShowLogin(true);
                  } else {
                    setQuery("");
                    setCategory("全部");
                  }
                }}
                className="mt-4 btn-press h-9 px-4 rounded-full bg-[#141413] text-white text-[12px] font-medium"
              >
                {apps.length === 0 ? "＋ 新增第一個工具" : "清除篩選"}
              </button>
            </div>
          )}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="glass-tile p-6 !min-h-0">
              <div className="w-8 h-8 rounded-[10px] bg-[#141413] text-white grid place-items-center text-[12px] font-bold mb-4">
                {"01"}
              </div>
              <div className="text-[13px] font-bold tracking-tight">
                {"貼 LINK 即成磚"}
              </div>
              <p className="text-[13px] text-[var(--text-2)] mt-2 leading-[1.6]">
                {
                  "在 Gemini 複製 Share Link，進入 EDIT 填好名稱、介紹及連結，即可建立工具方塊。"
                }
              </p>
            </div>
            <div className="glass-tile p-6 !min-h-0">
              <div className="w-8 h-8 rounded-[10px] bg-white border border-white shadow-sm grid place-items-center text-[12px] font-bold mb-4">
                {"02"}
              </div>
              <div className="text-[13px] font-bold tracking-tight">
                {"名稱、介紹、連結 · 就這麼簡單"}
              </div>
              <p className="text-[13px] text-[var(--text-2)] mt-2 leading-[1.6]">
                {
                  "不用上載 HTML 或修改程式。也可以選擇圖示、分類，隨時修改、排序或隱藏工具。"
                }
              </p>
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-[#141413] border border-[#1E1E1E] p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-[#D6F264]/20 blur-[24px]" />
              <div className="text-[12px] font-bold tracking-wide opacity-60">
                {"03 · 一個入口，集中你的工具"}
              </div>
              <p className="text-[13px] mt-3 leading-[1.7]">
                {mode === "local"
                  ? "目前為本機試用。雲端連接完成後，管理員儲存的公開工具將可在其他裝置及訪客頁面看到。"
                  : "清單儲存在雲端，公開工具可在不同裝置開啟。Gemini 連結本身的分享權限，仍由 Gemini 控制。"}
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/10 border border-white/10">
                {mode === "local" ? "◌ 雲端設定待完成" : "● 已連接雲端"}
              </div>
            </div>
          </div>
        </main>
        <footer className="mt-auto border-t border-white/60 bg-white/40 backdrop-blur-xl">
          <div className="max-w-[1320px] mx-auto px-5 sm:px-8 py-7 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[var(--text-2)]">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#141413] text-white grid place-items-center font-bold text-[12px]">
                {"N"}
              </span>
              <span>
                {"© "}
                {new Date().getFullYear()}
                {" NoScout Tools Hub"}
              </span>
              <span className="w-1 h-1 rounded-full bg-[var(--border-soft)]" />
              <span>{"一格一Link · 集中你的工具"}</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#D6F264]/30 text-[#2E5520] text-[10px] font-medium border border-[#D6F264]/40">
                {"\uD83C\uDF3F Scout Green"}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <a
                href="https://github.com/playerkousas-rgb/GEMINI"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#141413] text-white hover:opacity-90 shadow-md transition-all text-[12px] font-medium"
              >
                {"GitHub Repo ↗"}
              </a>
              <a
                href="https://spedmix.pages.dev/four-panel-comic"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press h-9 px-4 rounded-full bg-white border border-white shadow-sm inline-flex items-center text-[12px] font-medium"
              >
                {"參考版式"}
              </a>
            </div>
          </div>
        </footer>
      </div>
      {showLogin && (
        <LoginDialog mode={mode} onLogin={enterEditor} onClose={closeLogin} />
      )}
    </div>
  );
}

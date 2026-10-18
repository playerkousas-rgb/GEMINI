# NoScout · Gemini Tools Hub

**一個統一的 Gemini Share Link 入口。** 使用者在首頁開啟工具；管理員在 EDIT 填寫名稱、介紹及分享網址，儲存後就產生方塊，不需要上載 Canvas HTML、不需要手動改 JSON，也不需要每次重新部署。

保留原稿的米白／綠色、玻璃質感及方塊版面。使用 React + Vite，Vercel 部署；已連接 Supabase（與 APP STORE 共用同一專案，只使用 `gemini_hub_*` 表），提供管理密碼、點擊統計及訪客回報系統。

**© Scout System**

## 管理入口（不起眼設計）

- 沒有顯眼的 EDIT 按鈕。管理入口有兩條路：**網址直接開 `/edit`**，或**撳頁尾「© 年份 Scout System」**。
- 雲端模式只需輸入**管理密碼（出廠設定 `0728`）**，一個欄位就入到管理頁面；不需要電郵、不需要 Supabase 帳戶登入。
- 密碼在資料庫的 RPC 內驗證，前端不會硬編碼密碼，也不放任何 secret / service_role key。
- 這只是輕量保護（口令 `0728` 本身不是機密），用作擋住路人亂改清單及保護統計頁；不要放真正敏感的資料。要改密碼：在 Supabase SQL Editor 執行 `update public.gemini_hub_state set pin = '新密碼' where singleton;`
- 關閉分頁後需重新輸入密碼（只存於當前分頁的 `sessionStorage`）。

## 點擊統計及回報系統

- **點擊統計**：訪客點擊任何工具方塊即以 fire-and-forget 記錄一次點擊（不會阻慢開 link）。資料以「每日合計」形式儲存，不會堆積海量原始記錄。管理頁顯示今日／累積點擊及每工具排行榜。
- **回報系統**：訪客在工具方塊按「回報」，選類別＋補充（最多 300 字）。管理頁的回報收件箱可查看及刪除。回報設每日 20 則上限，並自動清理 90 日前的舊回報。
- 統計及回報全部經 Supabase RPC 直連，**不經過 Vercel serverless**。

## 瘦身機制（避免 Vercel 爆額度）

- 全站是純靜態檔案；所有動態功能（清單、統計、回報）都由 Supabase 直連處理，Vercel 零 function invocation。
- 點擊統計按日聚合、回報自動清理及限流，資料庫不會無限膨脹。
- `supabase-js` 以動態載入（code splitting）；主檔 gzip 約 62KB，沒有外部字型、沒有圖片資產。
- `vercel.json` 已設定長效快取（hashed assets `immutable`）及 HTML 不快取，重複訪問流量極低。
- 建置只在 push / 合併時進行；環境變數改動後記得無需再改（已一次性設定）。

## 現在可以試甚麼？

```sh
npm ci
npm run dev
```

需要 Node.js 22.12+。開首頁後點 **EDIT · 管理入口**，或直接開 `/edit`。`#edit` 和 `#admin` 亦支援。

在未填 Supabase 環境變數時，顯示 **「本機試用 · 尚未連接 Supabase」**：

- 無假 PIN、無假登入：按「進入本機試用」即可操作。
- 填寫名稱、介紹、Share Link，選 Emoji、分類及公開／隱藏，新增後即產生方塊。
- 可修改、刪除、以 ↑ ↓ 排序、搜尋及按分類篩選。
- 工具清單存於當前 origin 的 `localStorage`；重新整理仍保留，但**不會公開、跨裝置同步或自動上傳**。
- 退出試用後，可預覽訪客版面；被隱藏的項目不顯示。
- 無痕工作階段結束、清除網站資料、換網址／裝置可能失去本機草稿。請用「下載 JSON」備份。
- 本機試用沒有保安用途，不要在其中儲存私人資料；有瀏覽器存取權的人可查看本機草稿。

## 已加入 WEBSITE 的 Gemini 工具

`data/website-gemini.json` 收錄 2026-10-18 從 WEBSITE 公開資料讀取的「gemini 輔助工具」分類共 6 項：美食攝影、卡牌生成器、AI 對話助手、童設計、魔衣廚、相片工作台。

- 保留原始 ID、名稱、介紹及完整 Share Link（包括大小寫）；原站未設圖示，這裡補上 Emoji。
- 配合入口既有分類，AI 對話助手歸「工具」，其餘歸「創作」。可在 EDIT 修改。
- 本機模式首次載入會一次性補入缺少的工具；按 ID／完整連結去重，不覆蓋原有試填內容、編輯及排序。
- 匯入標記與草稿一同保存。之後自行刪除的工具不會因重新整理而復活。
- 這是一次性搬入，不會持續同步，也沒有寫入或修改 WEBSITE 的資料庫。
- 日後接上 Supabase，可在管理頁貼上此 JSON 匯入，或使用包含本機修改的完整備份。匯入會取代雲端清單，請先備份；不會自動向雲端寫入。
- 已核對來源記錄，不代表已驗證各 Gemini 工具的登入權限或生成能力。

## Supabase 接駁（已完成）

已與 APP STORE 共用同一 Supabase 專案（`SCOUTAPPSTORE`）；本程式只使用下列 `gemini_hub_*` 表及 RPC，不會改 WEBSITE 的 `apps`、`categories`、`pages`、`site_visits`、`submissions`。

1. `migrations/001_gemini_hub.sql`（已執行）：建立 `gemini_hub_state`（版本化清單＋PIN）、RLS 及讀寫 RPC。
2. `migrations/002_gemini_pin_report_stats.sql`（已執行）：改用共享 PIN 管理制（取代 Auth 白名單，已移除 `gemini_hub_admins`），加建每日點擊合計表 `gemini_hub_clicks`、回報表 `gemini_hub_reports` 及相關 RPC。
   - 訪客：`get_gemini_catalog`（只看公開工具）、`record_gemini_click`（點擊＋1）、`submit_gemini_report`（回報）。
   - 管理（需正確 PIN）：`save_gemini_catalog`、`get_gemini_stats`、`get_gemini_reports`、`delete_gemini_report`。
   - 兩份腳本均可重跑，不會清空原有資料。
3. Vercel 環境變數（已設定，只放公開值）：

   | 名稱 | 內容 |
   |---|---|
   | `VITE_SUPABASE_URL` | 該 Supabase 專案 HTTPS URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key（`sb_publishable_…`），或舊版 **anon** key |

   本機則複製 `.env.example` 為 `.env.local`，填入同樣兩項，重新啟動開發伺服器。
4. 開 `/edit`（或撳頁尾 © Scout System），輸入管理密碼即進入管理頁、統計及回報收件箱。
5. 如已試填本機工具，先在本機模式下載 JSON 備份，再於雲端模式匯入。匯入會取代雲端現有清單，必須確認，建議先備份。

### 權限及儲存方式

- 公開 URL 和 publishable/anon key 不是管理員憑證；管理權限由資料庫 RPC 內的 PIN 檢查決定。
- **絕不可在 `VITE_*`、GitHub 或前端程式放 secret key、service_role key 或 Gemini API key。**
- 管理密碼只存當前分頁的 `sessionStorage`。關閉分頁後需重新輸入；密碼本身只是輕量口令（出廠 `0728`），不是機密保險。
- 儲存成功才更新方塊；失敗保留輸入及提示錯誤，不會假裝成功或偷偷改存本機。
- 另一分頁已更改清單時，版本衝突會拒絕覆蓋。請先保留未儲存輸入，再重新載入。
- 刪除、排序、公開／隱藏會立即儲存。訪客在**重新載入首頁**後看到最新清單；本版本沒有即時推播更新。
- 單站上限 500 個工具。整份清單原子儲存，適合小型工具入口，不是大型多人內容管理系統。
- 本機草稿和雲端資料分開。配置了一半、連線失敗或驗證被拒時，**不會降級成本機並顯示發布成功**。

### 必須做的遠端驗收

SQL 已在隔離 PostgreSQL（PGlite）測試，前端雲端流程亦以模擬 API 測試；這些**不能取代真實 Supabase／Vercel 驗收**：

- 無痕訪客只能讀公開工具，無法讀取隱藏資料或直接寫表。
- 錯誤密碼被拒；正確密碼才見到隱藏工具及統計。
- 管理員新增一條測試 Share Link；另一個無痕視窗重新整理後看到方塊。
- 隱藏後，無痕訪客的 RPC 回應中也不應存在該資料；不是只靠 CSS 隱藏。
- 訪客點擊工具後，管理頁統計數字上升；「回報」送出後出現在收件箱。
- 兩個管理分頁同時編輯，後儲存的舊版本必須出現衝突提示。
- 網絡失敗不能顯示已發布；恢復網絡可重試，登出後管理表單消失。

## GitHub → Vercel

- 本工作分支固定為 `arena/68d92208-gemini`；合併 PR 到 `main` 後 Vercel 自動部署生產環境。
- Vercel 匯入 `playerkousas-rgb/GEMINI`，Framework 選 **Vite**，Root Directory 為根目錄，Build Command `npm run build`，Output Directory `dist`。
- `vercel.json` 將 `/edit` 和 `/edit/` 對應首頁，並為 hashed assets 加長效快取、HTML 設不快取（瘦身）。沒有攔截其他網址的全站 catch-all rewrite。

## 檔案結構

```text
index.html                       頁面入口、標題及描述
src/main.jsx                     啟動、載入及啟動錯誤提示
src/Hub.jsx                      儲存狀態、通知及資料快照
src/App.jsx                        原設計、工具管理、搜尋及分類
src/catalog.js                   工具資料和安全網址驗證
src/data/local-store.js          本機草稿（獨立儲存空間）
src/data/cloud-store.js          Supabase PIN 驗證、清單／統計／回報 RPC
src/data/store.js                根據環境設定選擇模式
src/components/LoginDialog.jsx   可鍵盤操作的管理密碼／試用對話框
src/components/ReportDialog.jsx  訪客回報對話框
src/components/InsightsPanel.jsx 管理頁點擊統計及回報收件箱
src/styles/theme.css             配色、玻璃效果、動畫及管理介面
src/styles/utilities.css         從原稿保留的 Tailwind 編譯樣式
migrations/001_gemini_hub.sql     清單資料表、RLS、讀寫 RPC
migrations/002_gemini_pin_report_stats.sql  PIN 制、點擊統計、回報系統
.env.example                     公開環境設定範本，不含祕密
tests/                           驗證、儲存及資料庫權限測試
vercel.json                      Vercel 部署與 /edit 路由
```

`utilities.css` 是原稿已編譯的樣式，不會產生新的 Tailwind class。新樣式可放進 `theme.css`。字型使用系統 fallback，無需 Google Fonts 外部載入。

## 測試及建置

```sh
npm run lint     # 檢查未定義變數等錯誤
npm test         # 包含 PGlite 實際執行 SQL 的角色／權限／衝突測試
npm run build    # lint + tests + Vite 正式建置
npm run preview # 預覽正式建置，綁定 0.0.0.0
```

亦已在 Chromium 檢查本機新增、重新整理、修改、排序、隱藏／公開、刪除、JSON 下載、直接 `/edit` 入口及 390px 手機版；以模擬 Supabase API 檢查登入、儲存失敗保留輸入、重試成功及登出。沒有呼叫真實 Supabase。

## 使用範圍

這是 Share Link 導航入口，不會替 Gemini 工具接駁 AI API，也不會繞過 Gemini 分享權限。請確認工具網址可供目標訪客使用。JSON 匯入／匯出只是備份及搬移功能，不是日常發布的必經步驟。

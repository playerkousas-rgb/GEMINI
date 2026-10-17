# NoScout · Gemini Tools Hub

**一個統一的 Gemini Share Link 入口。** 使用者在首頁開啟工具；管理員在 EDIT 填寫名稱、介紹及分享網址，儲存後就產生方塊，不需要上載 Canvas HTML、不需要手動改 JSON，也不需要每次重新部署。

保留原稿的米白／綠色、玻璃質感及方塊版面。使用 React + Vite，Vercel 部署；Supabase 連接程式及獨立資料表腳本已準備好，但**尚未連接或修改任何遠端 Supabase 專案**。

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

## 完成 Supabase 接駁（下一步，一次性設定）

**不是現在已完成的遠端設定。** 可使用獨立 Supabase 專案；若與 WEBSITE 共用專案，本程式只使用下列 `gemini_hub_*` 表及 RPC，不會改 WEBSITE 的 `apps`、`categories`、`pages`。

1. 在 Supabase SQL Editor 執行 `migrations/001_gemini_hub.sql`。
   - 建立 `gemini_hub_admins`（管理員白名單）及 `gemini_hub_state`（版本化清單）。
   - 開啟 RLS，撤銷訪客及一般登入者的直接表格存取權。
   - 任何訪客只可透過 `get_gemini_catalog` 讀取公開工具；隱藏工具不會傳到訪客瀏覽器。
   - `save_gemini_catalog` 在資料庫檢查管理員權限、資料格式及版本，原子儲存整份清單。
   - 可重跑腳本，不會清空原有 Gemini 清單。
2. 在 Authentication 建立／選擇你的管理員帳戶，設定強密碼並確認電郵。
3. 在 Table Editor 的 `gemini_hub_admins` 新增該 Auth 使用者的**真實 User UID**（`user_id` 欄位）。登入者必須在此白名單，才可管理 Gemini 入口。不要把 email 當 UUID 填入。
4. 在 Vercel 設定兩個公開環境變數：

   | 名稱 | 內容 |
   |---|---|
   | `VITE_SUPABASE_URL` | 該 Supabase 專案 HTTPS URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key（`sb_publishable_…`），或舊版 **anon** key |

   本機則複製 `.env.example` 為 `.env.local`，填入同樣兩項，重新啟動開發伺服器。
5. 重新部署 Vercel。`VITE_*` 在建置時注入，變更設定必須重建。Preview 和 Production 的環境變數分開配置。
6. 開 `/edit`，用管理員電郵及密碼登入。**沒有公開四位 PIN**，也不需要 `ADMIN_AUTH_PASSWORD` 或 service-role key。
7. 如已試填本機工具，先在本機模式下載 JSON 備份，再於雲端模式登入後匯入。匯入會取代雲端現有清單，必須確認，建議先備份。

### 權限及儲存方式

- 公開 URL 和 publishable/anon key 不是管理員憑證；權限由資料庫白名單和 RPC 檢查決定。
- **絕不可在 `VITE_*`、GitHub 或前端程式放 secret key、service_role key、帳戶密碼或 Gemini API key。**
- 登入使用 Supabase Auth，工作階段只存當前分頁的 `sessionStorage`。關閉分頁後需重新登入；原有分頁重新整理會保留 session，但仍須經管理權限檢查才可進入 EDIT。
- 系統不提供公開註冊功能；建議在 Supabase 關閉不需要的註冊，開啟合適的 Auth 限流／防濫用設定。
- 儲存成功才更新方塊；失敗保留輸入及提示錯誤，不會假裝成功或偷偷改存本機。
- 另一管理員／分頁已更改清單時，版本衝突會拒絕覆蓋。請先保留未儲存輸入，再重新載入。
- 刪除、排序、公開／隱藏會立即儲存。訪客在**重新載入首頁**後看到最新清單；本版本沒有即時推播更新。
- 單站上限 500 個工具。整份清單原子儲存，適合小型工具入口，不是大型多人內容管理系統。
- 本機草稿和雲端資料分開。配置了一半、連線失敗或登入被拒時，**不會降級成本機並顯示發布成功**。

### 必須做的遠端驗收

SQL 已在隔離 PostgreSQL（PGlite）測試，前端雲端流程亦以模擬 API 測試；這些**不能取代真實 Supabase／Vercel 驗收**：

- 無痕訪客只能讀公開工具，無法讀取隱藏資料或直接寫表。
- 錯誤密碼拒絕登入；一般 Auth 帳戶即使登入也沒有管理權。
- 管理員新增一條測試 Share Link；另一個無痕視窗重新整理後看到方塊。
- 隱藏後，無痕訪客的 RPC 回應中也不應存在該資料；不是只靠 CSS 隱藏。
- 兩個管理分頁同時編輯，後儲存的舊版本必須出現衝突提示。
- 網絡失敗不能顯示已發布；恢復網絡可重試，登出後管理表單消失。

## GitHub → Vercel

- 本工作分支固定為 `arena/15310772-gemini`；目前修改不代表已推送或部署。
- Vercel 匯入 `playerkousas-rgb/GEMINI`，Framework 選 **Vite**，Root Directory 為根目錄，Build Command `npm run build`，Output Directory `dist`。
- 如以目前分支發布，Production Branch 設為 `arena/15310772-gemini`；如正式站使用 `main`，先從本工作分支建立 PR，合併後發布。
- 無 Supabase 設定的部署仍只會提供明確標示的**本機試用**，不是已完成的公開雲端入口。
- `vercel.json` 將 `/edit` 和 `/edit/` 對應首頁。沒有攔截其他網址的全站 catch-all rewrite。

## 檔案結構

```text
index.html                       頁面入口、標題及描述
src/main.jsx                     啟動、載入及啟動錯誤提示
src/Hub.jsx                      儲存狀態、通知及資料快照
src/App.jsx                      原設計、工具管理、搜尋及分類
src/components/LoginDialog.jsx   可鍵盤操作的登入／試用對話框
src/catalog.js                   工具資料和安全網址驗證
src/data/local-store.js          本機草稿（獨立儲存空間）
src/data/cloud-store.js          Supabase 登入及清單 RPC
src/data/store.js                根據環境設定選擇模式
src/styles/theme.css             配色、玻璃效果、動畫及管理介面
src/styles/utilities.css         從原稿保留的 Tailwind 編譯樣式
migrations/001_gemini_hub.sql     獨立資料表、RLS、讀寫 RPC
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

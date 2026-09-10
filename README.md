# 個人運動紀錄平台

把訓練卡從一次性的對話產物，變成能長期累積的紀錄。
跟 Claude 討論出菜單 → 建一張訓練卡 → 練習時照表操課記重量與感受 → 之後回頭看趨勢。

規格見 [fitness-platform-spec.md](fitness-platform-spec.md)。

## 架構

Next.js 15（App Router）+ 自架 Supabase 的獨立 `fitness` schema，Docker 部署在自己的 VPS，
前面用 Caddy 做 HTTPS 反向代理。

**所有 Supabase 存取都在伺服器端進行。** 瀏覽器只跟 Next server 溝通，
登入後的 JWT 存在 httpOnly cookie，由伺服器帶去打 PostgREST，
權限由 Supabase Auth + `fitness` schema 上的 RLS policy 決定。
因此不需要 `service_role` 金鑰 —— 少一把萬能鑰匙在外面跑。

網站本身的資料變更走 Server Actions 而非 REST API：單人自用的情況下，
Server Actions 少一層樣板程式碼，也自動沿用同一套 cookie／RLS 權限。

## AI 教練 API

原始目的就是讓 AI 教練開課表，所以另外開了一組 `/api/coach/*`：

| 端點 | 用途 |
|---|---|
| `GET /api/coach/exercises` | 動作庫清單，開課表前先看能沿用什麼 |
| `GET /api/coach/history?limit=5&exercise=…` | 最近 N 次的重量／次數／感受，攤平成給語言模型讀的形狀 |
| `POST /api/coach/cards` | **一次送出整張卡**，動作庫沒有的依名稱自動建立 |

端點形狀刻意不照規格書第 4 節那樣拆成「先建動作、再建卡、再逐個加動作」——
教練吐出來的是一整份菜單，拆成多次呼叫只會增加寫錯的機會。

驗證用靜態 bearer token（`COACH_API_TOKEN`），未設定時整組回 503（fail closed）。
教練是機器呼叫、沒有使用者 JWT，RLS 無從判斷擁有者，因此**只有這幾個端點**
改用 `service_role` 寫入，並且每一筆都自己帶 owner 的 user_id。
一般頁面／Server Action 仍走 `src/lib/supabase.ts` 那條受 RLS 保護的路徑。

要讓 Claude 在對話中直接呼叫，見 [mcp/README.md](mcp/README.md)。

## 本機開發

1. 安裝依賴

   ```bash
   npm install
   ```

2. 設定資料庫與環境變數

   - 在 Supabase 執行 `supabase/schema.sql`（表建在獨立的 `fitness` schema，並開啟 RLS）
   - 複製 `.env.example` 成 `.env.local`，填入 `SUPABASE_URL` 與 `SUPABASE_ANON_KEY`

   **自架 Supabase 額外一步**（雲端版可略）：PostgREST 預設只暴露 `public`，
   必須把 `fitness` 加進 docker `.env` 的 `PGRST_DB_SCHEMAS`，再
   `docker compose up -d --force-recreate rest` 套用（用 `restart` 不會重讀 `.env`）。
   否則會出現 `Invalid schema: fitness`。

3. 啟動

   ```bash
   npm run dev
   ```

## 目錄

```
src/
  middleware.ts           session 續期 + 未登入導向 /login
  lib/
    supabase.ts           伺服器端 Supabase client（帶 cookie JWT + schema）
    queries.ts            資料讀取（RLS 自動限定在登入者的資料）
    types.ts              對應第 2 節資料模型的型別
  app/
    login/                email + 密碼登入
    page.tsx              訓練卡列表
    cards/new/            建立訓練卡
    cards/[id]/           卡片檢視 → 開始訓練
    cards/[id]/edit/      編輯卡片、增刪動作、調整順序
    train/[sessionId]/    訓練執行頁（MVP 核心）
    exercises/            動作庫 CRUD
    api/coach/            AI 教練 API（bearer token + service_role）
mcp/
  fitness-coach-mcp.mjs   MCP server，讓 Claude 在對話中直接建卡／讀歷史
supabase/
  schema.sql              fitness schema + 資料表 + RLS policy
  seed-sample-card.sql    範例訓練卡（想看實際長相時用）
```

## 目前進度

- [x] Phase 1 MVP：訓練卡 CRUD + 執行頁記重量／次數／感受
- [ ] Phase 2：組間休息倒數、持續秒數計時器
- [ ] Phase 3：重量／次數趨勢圖、感受紀錄時間軸
- [ ] Phase 4：PWA / 加到主畫面
- [ ] Phase 5（可選）：Claude 整合

## 部署

見 [DEPLOY.md](DEPLOY.md)。

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

資料變更走 Server Actions 而非 REST API：單人自用的情況下，
Server Actions 少一層樣板程式碼，也自動沿用同一套 cookie／RLS 權限。
（規格書第 4 節的 REST 端點留到 Phase 2 「讓 Claude 直接讀取」時再補。）

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
supabase/
  schema.sql              fitness schema + 資料表 + RLS policy
```

## 目前進度

- [x] Phase 1 MVP：訓練卡 CRUD + 執行頁記重量／次數／感受
- [ ] Phase 2：組間休息倒數、持續秒數計時器
- [ ] Phase 3：重量／次數趨勢圖、感受紀錄時間軸
- [ ] Phase 4：PWA / 加到主畫面
- [ ] Phase 5（可選）：Claude 整合

## 部署

見 [DEPLOY.md](DEPLOY.md)。

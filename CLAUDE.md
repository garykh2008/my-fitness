# my-fitness — 給 Claude Code 的專案筆記

個人運動紀錄平台，單人自用。規格見 `fitness-platform-spec.md`，部署見 `DEPLOY.md`。

## 環境速查

- **VPS**：`ssh root@vps.garyhsieh-proj.com`（157.245.157.184，DigitalOcean 2vCPU/4GB）
- **Supabase**：自架，`https://supabase.garyhsieh-proj.com`，
  docker 設定在 `/root/supabase-mangan-log/docker/`
- **本專案 schema**：`fitness`（與 `library` / `routine` / `todo` 並存）
- **對外網址／埠**：`fitness.garyhsieh-proj.com` → `127.0.0.1:3400`
- **Caddy**：host 上的 systemd 服務，一服務一檔放在 `/etc/caddy/sites/*.caddy`
- **同架構參考專案**：`D:\code\paintbook-lib`（my-library，同一台機器、同一套模式）

## 幾個容易踩的地方

1. **PostgREST 只暴露 `PGRST_DB_SCHEMAS` 列出的 schema**，改完必須
   `docker compose up -d --force-recreate rest`；用 `restart` 不會重讀 `.env`。
   症狀是 `Invalid schema: fitness`。

2. **`NEXT_PUBLIC_*` 是建置期變數**。Docker 建置階段沒有 env，
   所以這個專案刻意全部用伺服器端變數（`SUPABASE_URL` 等），執行期讀取。
   不要為了方便就把它們改成 `NEXT_PUBLIC_`，會在容器裡變成 undefined。

3. **`db: { schema }` 是執行期字串**，型別上收不進 `"public"` 字面量，
   `createServerClient(...)` 要 `as SupabaseClient` 承接。

4. **`card_exercises` 有 check constraint**：`mode='reps'` 時
   `target_hold_seconds` 必須是 null，`mode='hold'` 時 `target_reps_*` 必須是 null。
   寫入前要依 mode 清掉不相干的欄位。

5. **驗證登入一律用 `supabase.auth.getUser()`**，不要用 `getSession()` ——
   後者只讀 cookie 不向 Auth 伺服器驗證。

6. **VPS 記憶體只有 4GB**，`next build` 可能被 OOM kill。
   空間不足時先 `docker builder prune -f`。

## 資料存取慣例

- 讀取集中在 `src/lib/queries.ts`，變更用 Server Actions（各頁面的 `actions.ts`）
- RLS 會自動把查詢限定在登入者的資料，**不需要**在每個 query 手動加 `.eq("user_id", ...)`
- 但 **insert 時要自己帶 `user_id`**（上層表 `exercises` / `workout_cards` /
  `workout_sessions`），否則 `with check` 會擋下來
- 子表（`card_exercises` / `exercise_logs` / `set_logs`）沒有 `user_id`，
  RLS 靠 `exists` 回推上層表的擁有者

## 部署

手動流程，沒有 GitHub Actions：本機 `git push` → VPS `git pull && docker compose up -d --build`。

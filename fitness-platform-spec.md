# 個人運動紀錄平台 — 技術規格 v0.1

> 目的：把「訓練卡」的概念從單次 Artifact 升級成一個持續使用的個人網站。每次討論出新菜單後產生一張訓練卡，練習時記重量、記感受、用計時器抓時間，練完歷史資料能被回顧、被拿來給下一次的訓練建議。
>
> 使用者：單人（Gary）自用，部署在自己的 VPS，GitHub repo + SSH 部署，不考慮多租戶。VPS 上已有自架 Supabase，用 schema 區分不同應用的資料庫，這個平台直接沿用、開一個新 schema。

---

## 1. 核心使用情境

1. 在對話中和 Claude 討論出新的訓練菜單 → 建立一張新的「訓練卡」（動作、組數、次數/秒數、節奏、提示語）。
2. 訓練當天打開網站，選today的訓練卡，照表操課：
   - 每個動作展開後可看到節奏提示、cue
   - 每組打勾完成時記錄重量（或秒數）、次數
   - 需要組間休息時按下休息計時器；等長收縮類動作用持續秒數計時器
   - 練完可在動作旁留感受筆記（例如「下放到底上臂感受變多」）
3. 練完／隔幾天，回到對話中請 Claude 看歷史紀錄給建議，或平台自己畫出簡單的重量/感受趨勢。
4. 長期目標（Phase 2+）：平台能直接把最近幾次紀錄整理成摘要，貼進對話或透過 API 讓 Claude 直接讀取。

---

## 2. 資料模型

```
Exercise（動作庫）
├─ id
├─ name_zh, name_en
├─ category            // chest / back / legs / core ...
├─ default_equipment    // 啞鈴 / 瑜珈墊 / 徒手 ...
├─ default_cue          // 預設提示語，可在卡片內覆寫
└─ notes

WorkoutCard（訓練卡＝某次討論出的菜單模板）
├─ id
├─ title                 // 例：胸肌感受度優先
├─ thesis                // 一句話訓練邏輯
├─ created_at
├─ source_note           // 對應哪次對話 / 討論重點（純文字備註即可）
└─ status                // draft / active / archived

CardExercise（卡片內的動作設定，含順序）
├─ id
├─ workout_card_id (FK)
├─ exercise_id (FK)
├─ order_index           // 順序本身是資訊（例如先飛鳥再臥推）
├─ mode                  // 'reps' | 'hold'
├─ target_sets
├─ target_reps_min/max   // mode = reps 時使用
├─ target_hold_seconds   // mode = hold 時使用
├─ tempo_text            // 例："下放3秒/頂端擠壓1秒/上推1秒"
├─ cue_text              // 覆寫 Exercise.default_cue
└─ rest_seconds          // 這個動作的組間休息秒數

WorkoutSession（某次實際執行的紀錄）
├─ id
├─ workout_card_id (FK)
├─ performed_at
└─ overall_note          // 整場的整體感受／備註

ExerciseLog（該次 session 中，某個動作的執行紀錄）
├─ id
├─ session_id (FK)
├─ card_exercise_id (FK)
└─ feel_note              // 感受紀錄，例如「三頭還是有點明顯」

SetLog（單組紀錄）
├─ id
├─ exercise_log_id (FK)
├─ set_index
├─ weight_kg               // mode = reps
├─ reps_done                // mode = reps
├─ hold_seconds_done        // mode = hold
├─ completed_at
```

關聯：`WorkoutCard 1─n CardExercise`、`WorkoutCard 1─n WorkoutSession`、`WorkoutSession 1─n ExerciseLog`、`ExerciseLog 1─n SetLog`。

這樣設計的重點：訓練卡（模板）跟實際執行紀錄（session/log）分開，同一張卡可以練很多次，每次的重量、感受都各自留存，方便畫出同一動作跨時間的趨勢。

---

## 3. 功能規格

### 3.1 訓練卡管理
- 建立 / 編輯 / 封存訓練卡
- 卡片內動作可拖曳排序（順序是訓練邏輯的一部分，例如預先疲勞順序）
- 每個動作可設定 mode（次數型 / 持續秒數型）、目標組數、節奏文字、cue、組間休息秒數

### 3.2 訓練執行頁（手機優先）
- 顯示今天要練的卡片，逐一動作卡片式呈現（延續今天 Artifact 的視覺邏輯：編號、tempo chip、cue、勾選按鈕）
- 點擊某一組 → 跳出輸入框（重量 + 次數，或持續秒數）→ 存檔即標記完成
- 完成一組後自動彈出「組間休息計時器」，讀秒結束震動 / 提示音
- mode = hold 的動作（例如等長收縮）用「持續秒數計時器」，開始計時、時間到自動停止並記錄
- 每個動作旁有一個感受筆記輸入欄（純文字，選填）
- 整場結束後可留一則 overall_note

### 3.3 歷史與進度
- 依動作篩選，畫出重量 / 完成次數的時間趨勢（簡單折線圖即可）
- 感受紀錄用時間軸列表呈現，方便回顧「上次這個動作的感受是什麼」
- 匯出最近 N 次紀錄為結構化摘要（給 Claude 對話貼上用，Phase 1 先手動複製，Phase 2 再考慮 API 串接）

### 3.4 動作庫
- CRUD 動作，設定預設 cue、器材、分類

---

## 4. API 設計（REST 風格，Next.js Route Handlers 或同等框架）

```
GET    /api/exercises
POST   /api/exercises
PATCH  /api/exercises/:id

GET    /api/cards
POST   /api/cards
GET    /api/cards/:id
PATCH  /api/cards/:id
POST   /api/cards/:id/exercises          // 新增一個 CardExercise
PATCH  /api/card-exercises/:id           // 調整排序/設定

POST   /api/cards/:id/sessions           // 開始一次訓練（建立 WorkoutSession）
GET    /api/sessions/:id
PATCH  /api/sessions/:id                 // 更新 overall_note

POST   /api/sessions/:id/exercise-logs   // 建立/更新某動作的 ExerciseLog（含 feel_note）
POST   /api/exercise-logs/:id/set-logs   // 新增一組紀錄

GET    /api/progress?exercise_id=...     // 該動作歷史重量/次數序列，給圖表用
GET    /api/sessions/:id/summary         // 產出給 Claude 看的文字摘要
```

---

## 5. 技術棧建議

單人自用、部署在自己的 VPS、要能長期低維護成本，建議：

| 項目 | 建議 | 原因 |
|---|---|---|
| 框架 | **Next.js（App Router）** | 前後端同一個 repo，API Route + React UI，部署單一 Node process，Claude Code 生態很熟 |
| 資料庫 | **Postgres，用你自架 Supabase 的獨立 schema**（例如 `fitness`） | 沿用你 VPS 上既有的基礎設施，不用另外起服務、另外管備份；資料模型（第 2 節）直接對應成這個 schema 底下的 table 即可 |
| DB 存取 | Prisma 或 Drizzle 直連 Postgres 連線字串（指定 `search_path=fitness`），或改用 `supabase-js` client | 單人用不太需要 Row Level Security，直連 ORM 最省事；如果之後想用 Supabase 的 Auth/Storage/Realtime，用 `supabase-js` 會更順手，可以兩種都先列進待辦，到 Claude Code 現場再定 |
| 樣式 | Tailwind CSS | 開發速度快，跟今天訓練卡 Artifact 的設計語言可以延續 |
| 圖表 | 輕量方案（例如 Recharts 或純 SVG） | 只需要簡單折線圖，不需要重型圖表庫 |
| PWA | 加上 manifest + service worker | 練習時直接「加到主畫面」開啟，體驗接近原生 App，這點今天用 Artifact 時你已經體驗到手機瀏覽器開連結不方便，PWA 可以解決 |
| 認證 | **Supabase Auth**（email+password 或 magic link） | Supabase 本來就在跑，直接用內建 Auth 比自己刻登入系統省事，單人帳號也不用額外維護 |

---

## 6. 部署架構

延續你現有其他專案的模式：

```
GitHub repo (main)
   │  git push
   ▼
GitHub Actions
   │  build → SSH 連到 VPS
   ▼
VPS
   ├─ pull 最新 code
   ├─ 安裝依賴 / build
   └─ pm2 restart（或 docker compose up -d --build）
```

- 資料庫直接用既有的自架 Supabase 實例，新增一個獨立 schema（例如 `fitness`），不用額外起 DB 容器
- 連線字串（含 schema）用環境變數在 VPS 上設定，不進 repo；如果其他專案已經有共用的 `.env` 管理方式，比照辦理即可
- 備份沿用你 Supabase 現有的備份機制（如果已經有），不用重新設計一套

---

## 7. 建議開發階段

1. **MVP**：訓練卡 CRUD + 執行頁記重量/次數/感受（不含計時器、不含圖表）— 先把今天這張訓練卡的功能複刻成可持續使用的版本
2. **計時器**：組間休息倒數、持續秒數動作計時器
3. **歷史與趨勢**：重量/次數的時間序列圖表、感受紀錄時間軸
4. **PWA / 主畫面安裝體驗**
5.（可選）**Claude 整合**：`sessions/:id/summary` 之外，評估是否要接 Claude API，讓平台在練完後自動產生建議，而不是手動貼回對話

---

## 8. 待你在 Claude Code 現場決定的事

- Prisma/Drizzle 直連 Postgres schema，還是改用 `supabase-js` client
- `fitness` schema 底下的 table 要不要套用 Supabase 的 Row Level Security（單人用理論上不必要，但如果之後想開放家人/朋友帳號可以先設計好）
- 圖表庫最終選哪個
- repo 要獨立一個，還是跟其他專案共用 monorepo

# 部署（VPS + Docker + Caddy）

環境：DigitalOcean droplet（Ubuntu），已用 Docker 跑自架 Supabase，Caddy 做 HTTPS。
Supabase 在 `supabase.garyhsieh-proj.com`，這個 app 用 `fitness.garyhsieh-proj.com`。

對外埠用 **3400**（3100 是 my-library、3300 是 todo）。

---

## 0. DNS

`garyhsieh-proj.com` 沒有 wildcard，每個子網域都要自己開一筆：

| 類型 | 名稱 | 值 |
|---|---|---|
| `A` | `fitness` | `157.245.157.184` |

若在 Cloudflare，Proxy 要設成 **DNS only（灰雲）**，否則 Caddy 申請 Let's Encrypt 憑證會失敗。

---

## 1. Supabase 準備（只要做一次）

### 1.1 建 schema 與資料表

```bash
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/schema.sql
```

`schema.sql` 是冪等的（`create ... if not exists` + `drop policy if exists`），重跑安全。

### 1.2 讓 PostgREST 看得到 fitness schema

PostgREST 預設只暴露 `public`。編輯 `/root/supabase-mangan-log/docker/.env`，
把 `fitness` 加進 `PGRST_DB_SCHEMAS`：

```
PGRST_DB_SCHEMAS=public,storage,graphql_public,library,routine,todo,fitness
```

套用（**必須 `--force-recreate`**，用 `restart` 不會重讀 `.env`）：

```bash
cd /root/supabase-mangan-log/docker && docker compose up -d --force-recreate rest
```

驗證：帶 `Accept-Profile: fitness` 用 anon key 打 REST，
應該回 `permission denied for schema fitness`（代表 schema 有暴露、anon 被 RLS 擋住），
而**不是** `Invalid schema: fitness`（那代表沒暴露成功）。

### 1.3 建立使用者帳號

自架 Supabase 的 SMTP 是預設的假設定，magic link 寄不出去，所以走 email + 密碼。
`ENABLE_EMAIL_AUTOCONFIRM=true`，不需要收確認信。

用 Admin API 直接建（在 VPS 上執行，`SERVICE_ROLE_KEY` 從 Supabase 的 `.env` 讀）：

```bash
cd /root/supabase-mangan-log/docker
SRK=$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)
curl -s -X POST "http://localhost:8000/auth/v1/admin/users" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  -H "Content-Type: application/json" \
  -d '{"email":"你的email","password":"你的密碼","email_confirm":true}'
```

建完之後把註冊關掉，免得別人拿你的 Supabase 網址亂註冊：

```
DISABLE_SIGNUP=true
```

```bash
docker compose up -d --force-recreate auth
```

---

## 2. 取得程式碼

```bash
cd ~
git clone git@github.com:garykh2008/my-fitness.git
cd my-fitness
```

---

## 3. 環境變數

```bash
cp .env.production.example .env.production
nano .env.production
```

`SUPABASE_ANON_KEY` 的值在 `/root/supabase-mangan-log/docker/.env` 裡，變數名 `ANON_KEY`。

這些是**執行期**變數（沒有 `NEXT_PUBLIC_` 前綴），改完只要 `docker compose up -d`
就會生效，不需要 `--build`。

---

## 4. 建置並啟動

先確認埠沒被佔用：

```bash
sudo ss -tlnp | grep ':3400'    # 沒輸出＝可用
```

```bash
docker compose up -d --build
docker compose ps
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3400/login   # 期望 200
```

> VPS 記憶體只有 4GB，`next build` 尖峰吃得不少。若 build 被 OOM kill，
> 先 `docker builder prune -f` 清出空間，或在本機 build 好推映像。

---

## 5. Caddy

新增 `/etc/caddy/sites/fitness.caddy`：

```caddy
# 個人運動紀錄平台
fitness.garyhsieh-proj.com {
	reverse_proxy 127.0.0.1:3400
}
```

用 `127.0.0.1` 而非 `localhost`：容器只綁 IPv4，`localhost` 可能被解析成 `::1`
而連不到，造成時好時壞的 502。

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 6. 驗收

打開 `https://fitness.garyhsieh-proj.com`：

1. 未登入自動導向 `/login` ✅
2. 用 email + 密碼登入 ✅
3. 動作庫建動作 → 建訓練卡 → 加動作、調順序 ✅
4. 開始訓練 → 點某一組記重量次數 → 顯示 ✓ ✅
5. 寫感受筆記（離開輸入框自動存）→ 結束訓練寫整場備註 ✅
6. 手機瀏覽器「加到主畫面」 ✅

---

## 之後要更新版本

本機改完 → `git push`；VPS 上：

```bash
cd ~/my-fitness
git pull
docker compose up -d --build
```

只改環境變數的話不用 `--build`：

```bash
docker compose up -d
```

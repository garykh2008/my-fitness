import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 只給 /api/coach/* 用的 service_role client。
//
// 教練是機器呼叫、沒有使用者 session，所以拿不到 JWT，RLS 也就無從判斷擁有者。
// 這裡改用 service_role（會繞過 RLS），因此**每一筆寫入都必須自己帶 ownerUserId()**。
// 這把金鑰只存在伺服器端，且只有通過 COACH_API_TOKEN 驗證的請求才走得到這裡。
//
// 一般的頁面／Server Action 請用 src/lib/supabase.ts 的 getSupabase()，那條路徑
// 帶使用者 JWT、受 RLS 保護，不要為了方便改用這支。

let cachedClient: SupabaseClient | null = null;
let cachedOwnerId: string | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.SUPABASE_DB_SCHEMA || "fitness";

  if (!url || !key) {
    throw new Error(
      "教練 API 尚未啟用：伺服器未設定 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。"
    );
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  }) as SupabaseClient;

  return cachedClient;
}

/**
 * 教練建立的資料要掛在誰名下。
 * 用 email 查（設定檔比較好讀），查到後在 process 內快取。
 */
export async function ownerUserId(): Promise<string> {
  if (cachedOwnerId) return cachedOwnerId;

  const explicit = process.env.COACH_OWNER_USER_ID;
  if (explicit) {
    cachedOwnerId = explicit;
    return explicit;
  }

  const email = process.env.COACH_OWNER_EMAIL;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !url || !key) {
    throw new Error(
      "教練 API 尚未啟用：請設定 COACH_OWNER_EMAIL（或 COACH_OWNER_USER_ID）。"
    );
  }

  // GoTrue 的 admin API：PostgREST 不會暴露 auth schema，只能走這裡
  const res = await fetch(
    `${url}/auth/v1/admin/users?page=1&per_page=200`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );

  if (!res.ok) {
    throw new Error(`查詢使用者失敗（HTTP ${res.status}）。`);
  }

  const body = (await res.json()) as { users?: { id: string; email?: string }[] };
  const user = body.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    throw new Error(`找不到使用者 ${email}。`);
  }

  cachedOwnerId = user.id;
  return user.id;
}

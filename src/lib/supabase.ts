import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// 所有 Supabase 存取都在伺服器端進行：
// 用 anon key 建 client，但帶上使用者登入後存在 httpOnly cookie 裡的 JWT，
// 資料權限完全交給 fitness schema 上的 RLS policy 決定（見 supabase/schema.sql）。
//
// 這些變數沒有 NEXT_PUBLIC_ 前綴，所以是執行期讀取，
// Docker 映像不需要為了換設定重建。

export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const schema = process.env.SUPABASE_DB_SCHEMA || "fitness";
  return { url, anonKey, schema };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = supabaseEnv();
  return Boolean(url && anonKey);
}

/**
 * 給 Server Component / Server Action / Route Handler 用的 client。
 *
 * 注意：Server Component 不能寫 cookie，所以 setAll 在那個情境下會拋錯，
 * 這裡吞掉即可 —— session 的續期交給 middleware 處理（見 src/middleware.ts）。
 */
export async function getSupabase(): Promise<SupabaseClient> {
  const { url, anonKey, schema } = supabaseEnv();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase 未設定：請在 .env.local（或 VPS 上的 .env.production）填入 SUPABASE_URL 與 SUPABASE_ANON_KEY"
    );
  }

  const cookieStore = await cookies();

  // schema 是執行期字串（非字面量），型別上以預設 client 型別承接即可
  return createServerClient(url, anonKey, {
    db: { schema },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 在 Server Component 中呼叫，交給 middleware 續期
        }
      },
    },
  }) as SupabaseClient;
}

/** 取得目前登入的使用者；未登入回 null。 */
export async function getCurrentUser() {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

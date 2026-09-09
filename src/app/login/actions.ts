"use server";

import { redirect } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function signIn(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "伺服器尚未設定 Supabase 連線（SUPABASE_URL / SUPABASE_ANON_KEY）。" };
  }

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");

  if (!email || !password) {
    return { error: "請填入 email 與密碼。" };
  }

  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "登入失敗：email 或密碼不正確。" };
  }

  // 只接受站內相對路徑，避免被塞外部網址做開放轉址
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

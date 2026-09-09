"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, getCurrentUser } from "@/lib/supabase";

function text(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
}

export async function createExercise(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const name_zh = text(formData, "name_zh");
  if (!name_zh) return { error: "請填入動作名稱。" };

  const user = await getCurrentUser();
  if (!user) return { error: "尚未登入。" };

  const supabase = await getSupabase();
  const { error } = await supabase.from("exercises").insert({
    user_id: user.id,
    name_zh,
    name_en: text(formData, "name_en"),
    category: text(formData, "category"),
    default_equipment: text(formData, "default_equipment"),
    default_cue: text(formData, "default_cue"),
    notes: text(formData, "notes"),
  });

  if (error) return { error: `新增失敗：${error.message}` };

  revalidatePath("/exercises");
  return {};
}

export async function updateExercise(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  const name_zh = text(formData, "name_zh");
  if (!id) return { error: "缺少動作 id。" };
  if (!name_zh) return { error: "請填入動作名稱。" };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from("exercises")
    .update({
      name_zh,
      name_en: text(formData, "name_en"),
      category: text(formData, "category"),
      default_equipment: text(formData, "default_equipment"),
      default_cue: text(formData, "default_cue"),
      notes: text(formData, "notes"),
    })
    .eq("id", id);

  if (error) return { error: `更新失敗：${error.message}` };

  revalidatePath("/exercises");
  return {};
}

export async function deleteExercise(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await getSupabase();
  // 動作若已被訓練卡引用，FK 是 on delete restrict，這裡會失敗 —— 這是刻意的
  await supabase.from("exercises").delete().eq("id", id);

  revalidatePath("/exercises");
}

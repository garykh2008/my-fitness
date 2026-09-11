"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, getCurrentUser } from "@/lib/supabase";

function text(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function int(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * 預設訓練參數。mode 與目標欄位必須對得起來，
 * 否則會撞上 exercises_default_targets_check。
 */
function defaultsFrom(formData: FormData) {
  const raw = String(formData.get("default_mode") ?? "reps");
  const mode = raw === "hold" || raw === "interval" ? raw : "reps";
  return {
    default_mode: mode,
    default_sets: int(formData, "default_sets"),
    default_reps_min: mode === "reps" ? int(formData, "default_reps_min") : null,
    default_reps_max: mode === "reps" ? int(formData, "default_reps_max") : null,
    default_hold_seconds:
      mode === "hold" ? int(formData, "default_hold_seconds") : null,
    default_interval_seconds:
      mode === "interval" ? int(formData, "default_interval_seconds") : null,
    default_tempo: text(formData, "default_tempo"),
    default_rest_seconds: int(formData, "default_rest_seconds"),
    media_url: text(formData, "media_url"),
  };
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
    ...defaultsFrom(formData),
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
      ...defaultsFrom(formData),
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

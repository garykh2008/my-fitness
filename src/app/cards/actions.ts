"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase, getCurrentUser } from "@/lib/supabase";
import { cardExerciseDefaults } from "@/lib/types";
import type { Exercise } from "@/lib/types";

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

// --- 訓練卡本身 -------------------------------------------------

export async function createCard(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const title = text(formData, "title");
  if (!title) return { error: "請填入訓練卡標題。" };

  const user = await getCurrentUser();
  if (!user) return { error: "尚未登入。" };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("workout_cards")
    .insert({
      user_id: user.id,
      title,
      thesis: text(formData, "thesis"),
      source_note: text(formData, "source_note"),
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { error: `建立失敗：${error?.message}` };

  revalidatePath("/");
  redirect(`/cards/${data.id}/edit`);
}

export async function updateCard(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  const title = text(formData, "title");
  if (!id) return { error: "缺少卡片 id。" };
  if (!title) return { error: "請填入訓練卡標題。" };

  const supabase = await getSupabase();
  const { error } = await supabase
    .from("workout_cards")
    .update({
      title,
      thesis: text(formData, "thesis"),
      source_note: text(formData, "source_note"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: `更新失敗：${error.message}` };

  revalidatePath(`/cards/${id}`);
  revalidatePath("/");
  return {};
}

export async function archiveCard(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await getSupabase();
  await supabase
    .from("workout_cards")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/");
  redirect("/");
}

// --- 卡片內的動作 -----------------------------------------------

/**
 * 一鍵把動作加進卡片：直接套用動作庫裡的預設訓練參數。
 *
 * 建卡的當下多半只想決定「練哪些、什麼順序」，組數次數之類的細項
 * 動作庫裡已經有一組合理的值了，要調再進去改就好。
 */
export async function quickAddCardExercise(formData: FormData): Promise<void> {
  const workout_card_id = String(formData.get("workout_card_id") ?? "");
  const exercise_id = String(formData.get("exercise_id") ?? "");
  if (!workout_card_id || !exercise_id) return;

  const supabase = await getSupabase();

  const { data: exercise } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", exercise_id)
    .maybeSingle<Exercise>();

  if (!exercise) return;

  // 放到最後面
  const { data: last } = await supabase
    .from("card_exercises")
    .select("order_index")
    .eq("workout_card_id", workout_card_id)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle<{ order_index: number }>();

  await supabase.from("card_exercises").insert({
    workout_card_id,
    exercise_id,
    order_index: (last?.order_index ?? -1) + 1,
    ...cardExerciseDefaults(exercise),
  });

  revalidatePath(`/cards/${workout_card_id}`);
  revalidatePath(`/cards/${workout_card_id}/edit`);
}

export async function addCardExercise(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const workout_card_id = String(formData.get("workout_card_id") ?? "");
  const exercise_id = String(formData.get("exercise_id") ?? "");
  if (!workout_card_id) return { error: "缺少卡片 id。" };
  if (!exercise_id) return { error: "請選一個動作。" };

  const mode = String(formData.get("mode") ?? "reps") === "hold" ? "hold" : "reps";
  const supabase = await getSupabase();

  // 放到最後面
  const { data: last } = await supabase
    .from("card_exercises")
    .select("order_index")
    .eq("workout_card_id", workout_card_id)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle<{ order_index: number }>();

  const { error } = await supabase.from("card_exercises").insert({
    workout_card_id,
    exercise_id,
    order_index: (last?.order_index ?? -1) + 1,
    mode,
    target_sets: int(formData, "target_sets"),
    // mode 與目標欄位要對得起來，否則會踩到 DB 的 check constraint
    target_reps_min: mode === "reps" ? int(formData, "target_reps_min") : null,
    target_reps_max: mode === "reps" ? int(formData, "target_reps_max") : null,
    target_hold_seconds:
      mode === "hold" ? int(formData, "target_hold_seconds") : null,
    tempo_text: text(formData, "tempo_text"),
    cue_text: text(formData, "cue_text"),
    rest_seconds: int(formData, "rest_seconds"),
  });

  if (error) return { error: `新增動作失敗：${error.message}` };

  revalidatePath(`/cards/${workout_card_id}`);
  revalidatePath(`/cards/${workout_card_id}/edit`);
  return {};
}

export async function updateCardExercise(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  const workout_card_id = String(formData.get("workout_card_id") ?? "");
  if (!id) return { error: "缺少動作設定 id。" };

  const mode = String(formData.get("mode") ?? "reps") === "hold" ? "hold" : "reps";
  const supabase = await getSupabase();

  const { error } = await supabase
    .from("card_exercises")
    .update({
      mode,
      target_sets: int(formData, "target_sets"),
      target_reps_min: mode === "reps" ? int(formData, "target_reps_min") : null,
      target_reps_max: mode === "reps" ? int(formData, "target_reps_max") : null,
      target_hold_seconds:
        mode === "hold" ? int(formData, "target_hold_seconds") : null,
      tempo_text: text(formData, "tempo_text"),
      cue_text: text(formData, "cue_text"),
      rest_seconds: int(formData, "rest_seconds"),
    })
    .eq("id", id);

  if (error) return { error: `更新失敗：${error.message}` };

  revalidatePath(`/cards/${workout_card_id}`);
  revalidatePath(`/cards/${workout_card_id}/edit`);
  return {};
}

export async function removeCardExercise(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const workout_card_id = String(formData.get("workout_card_id") ?? "");
  if (!id) return;

  const supabase = await getSupabase();
  await supabase.from("card_exercises").delete().eq("id", id);

  revalidatePath(`/cards/${workout_card_id}`);
  revalidatePath(`/cards/${workout_card_id}/edit`);
}

/**
 * 上移／下移一個動作。順序是訓練邏輯的一部分（例如預先疲勞），
 * 所以用相鄰兩筆交換 order_index 的方式處理。
 */
export async function moveCardExercise(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const workout_card_id = String(formData.get("workout_card_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !workout_card_id) return;

  const supabase = await getSupabase();
  const { data: rows } = await supabase
    .from("card_exercises")
    .select("id, order_index")
    .eq("workout_card_id", workout_card_id)
    .order("order_index", { ascending: true })
    .returns<{ id: string; order_index: number }[]>();

  if (!rows) return;

  const i = rows.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;

  // 兩筆互換。order_index 沒有 unique 限制，可以直接寫。
  await supabase
    .from("card_exercises")
    .update({ order_index: rows[j].order_index })
    .eq("id", rows[i].id);
  await supabase
    .from("card_exercises")
    .update({ order_index: rows[i].order_index })
    .eq("id", rows[j].id);

  revalidatePath(`/cards/${workout_card_id}`);
  revalidatePath(`/cards/${workout_card_id}/edit`);
}

// --- 開始一次訓練 -----------------------------------------------

export async function startSession(formData: FormData): Promise<void> {
  const workout_card_id = String(formData.get("workout_card_id") ?? "");
  if (!workout_card_id) return;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: user.id, workout_card_id })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(`無法開始訓練：${error?.message}`);

  redirect(`/train/${data.id}`);
}

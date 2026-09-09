"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

function num(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 確保某個 (session, card_exercise) 的 ExerciseLog 存在，回傳它的 id。
 * 記第一組或寫第一則感受時才會建立，不會為沒做的動作留空紀錄。
 */
async function ensureExerciseLog(
  sessionId: string,
  cardExerciseId: string
): Promise<string> {
  const supabase = await getSupabase();

  const { data: existing } = await supabase
    .from("exercise_logs")
    .select("id")
    .eq("session_id", sessionId)
    .eq("card_exercise_id", cardExerciseId)
    .maybeSingle<{ id: string }>();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("exercise_logs")
    .insert({ session_id: sessionId, card_exercise_id: cardExerciseId })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(`建立動作紀錄失敗：${error?.message}`);
  return data.id;
}

/** 記錄一組。同一組再存一次就是覆寫（unique(exercise_log_id, set_index) + upsert）。 */
export async function saveSet(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const sessionId = String(formData.get("session_id") ?? "");
  const cardExerciseId = String(formData.get("card_exercise_id") ?? "");
  const setIndex = Number(formData.get("set_index") ?? NaN);

  if (!sessionId || !cardExerciseId || !Number.isFinite(setIndex)) {
    return { error: "缺少必要參數。" };
  }

  try {
    const logId = await ensureExerciseLog(sessionId, cardExerciseId);
    const supabase = await getSupabase();

    const { error } = await supabase.from("set_logs").upsert(
      {
        exercise_log_id: logId,
        set_index: setIndex,
        weight_kg: num(formData, "weight_kg"),
        reps_done: num(formData, "reps_done"),
        hold_seconds_done: num(formData, "hold_seconds_done"),
        completed_at: new Date().toISOString(),
      },
      { onConflict: "exercise_log_id,set_index" }
    );

    if (error) return { error: `儲存失敗：${error.message}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "儲存失敗。" };
  }

  revalidatePath(`/train/${sessionId}`);
  return {};
}

/** 刪掉一組（記錯了想重來） */
export async function deleteSet(formData: FormData): Promise<void> {
  const sessionId = String(formData.get("session_id") ?? "");
  const setLogId = String(formData.get("set_log_id") ?? "");
  if (!setLogId) return;

  const supabase = await getSupabase();
  await supabase.from("set_logs").delete().eq("id", setLogId);

  revalidatePath(`/train/${sessionId}`);
}

/** 某個動作的感受筆記 */
export async function saveFeelNote(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const sessionId = String(formData.get("session_id") ?? "");
  const cardExerciseId = String(formData.get("card_exercise_id") ?? "");
  const feelNote = String(formData.get("feel_note") ?? "").trim() || null;

  if (!sessionId || !cardExerciseId) return { error: "缺少必要參數。" };

  try {
    const logId = await ensureExerciseLog(sessionId, cardExerciseId);
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("exercise_logs")
      .update({ feel_note: feelNote })
      .eq("id", logId);

    if (error) return { error: `儲存失敗：${error.message}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "儲存失敗。" };
  }

  revalidatePath(`/train/${sessionId}`);
  return {};
}

/** 整場結束：存 overall_note 並回首頁 */
export async function finishSession(formData: FormData): Promise<void> {
  const sessionId = String(formData.get("session_id") ?? "");
  const overallNote = String(formData.get("overall_note") ?? "").trim() || null;
  if (!sessionId) return;

  const supabase = await getSupabase();
  await supabase
    .from("workout_sessions")
    .update({ overall_note: overallNote })
    .eq("id", sessionId);

  revalidatePath("/");
  redirect("/");
}

/** 練到一半反悔：整場刪掉（子表都是 on delete cascade） */
export async function abandonSession(formData: FormData): Promise<void> {
  const sessionId = String(formData.get("session_id") ?? "");
  const cardId = String(formData.get("workout_card_id") ?? "");
  if (!sessionId) return;

  const supabase = await getSupabase();
  await supabase.from("workout_sessions").delete().eq("id", sessionId);

  revalidatePath("/");
  redirect(cardId ? `/cards/${cardId}` : "/");
}

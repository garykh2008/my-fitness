import { getSupabase } from "./supabase";
import type {
  Exercise,
  WorkoutCardDetail,
  WorkoutSession,
  ExerciseLogWithSets,
} from "./types";

// 資料讀取集中在這裡。所有查詢都靠 RLS 自動限定在目前登入者的資料，
// 因此不需要在每個 query 手動加 .eq("user_id", ...)。

export async function listExercises(): Promise<Exercise[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .order("category", { ascending: true, nullsFirst: false })
    .order("name_zh", { ascending: true })
    .returns<Exercise[]>();

  if (error) throw new Error(`讀取動作庫失敗：${error.message}`);
  return data ?? [];
}

export async function getCardDetail(
  cardId: string
): Promise<WorkoutCardDetail | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("workout_cards")
    .select("*, card_exercises(*, exercise:exercises(*))")
    .eq("id", cardId)
    .maybeSingle();

  if (error) throw new Error(`讀取訓練卡失敗：${error.message}`);
  if (!data) return null;

  const card = data as unknown as WorkoutCardDetail;
  // PostgREST 的巢狀結果不保證順序，這裡自己排
  card.card_exercises.sort((a, b) => a.order_index - b.order_index);
  return card;
}

export interface SessionDetail {
  session: WorkoutSession;
  card: WorkoutCardDetail;
  /** key = card_exercise_id */
  logs: Map<string, ExerciseLogWithSets>;
}

export async function getSessionDetail(
  sessionId: string
): Promise<SessionDetail | null> {
  const supabase = await getSupabase();

  const { data: session, error: sErr } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<WorkoutSession>();

  if (sErr) throw new Error(`讀取訓練紀錄失敗：${sErr.message}`);
  if (!session) return null;

  const card = await getCardDetail(session.workout_card_id);
  if (!card) return null;

  const { data: logs, error: lErr } = await supabase
    .from("exercise_logs")
    .select("*, set_logs(*)")
    .eq("session_id", sessionId)
    .returns<ExerciseLogWithSets[]>();

  if (lErr) throw new Error(`讀取動作紀錄失敗：${lErr.message}`);

  const map = new Map<string, ExerciseLogWithSets>();
  for (const log of logs ?? []) {
    log.set_logs.sort((a, b) => a.set_index - b.set_index);
    map.set(log.card_exercise_id, log);
  }

  return { session, card, logs: map };
}

/** 某張卡最近一次的訓練紀錄（用來在卡片頁顯示「上次練是什麼時候」） */
export async function getLatestSession(
  cardId: string
): Promise<WorkoutSession | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("workout_card_id", cardId)
    .order("performed_at", { ascending: false })
    .limit(1)
    .maybeSingle<WorkoutSession>();

  if (error) throw new Error(`讀取訓練紀錄失敗：${error.message}`);
  return data;
}

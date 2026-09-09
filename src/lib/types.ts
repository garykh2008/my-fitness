// 對應 supabase/schema.sql 的資料模型（規格書第 2 節）

export type ExerciseMode = "reps" | "hold";
export type CardStatus = "draft" | "active" | "archived";

export interface Exercise {
  id: string;
  user_id: string;
  name_zh: string;
  name_en: string | null;
  category: string | null;
  default_equipment: string | null;
  default_cue: string | null;
  notes: string | null;
  created_at: string;
}

export interface WorkoutCard {
  id: string;
  user_id: string;
  title: string;
  thesis: string | null;
  source_note: string | null;
  status: CardStatus;
  created_at: string;
  updated_at: string;
}

export interface CardExercise {
  id: string;
  workout_card_id: string;
  exercise_id: string;
  order_index: number;
  mode: ExerciseMode;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_hold_seconds: number | null;
  tempo_text: string | null;
  cue_text: string | null;
  rest_seconds: number | null;
  created_at: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  workout_card_id: string;
  performed_at: string;
  overall_note: string | null;
  created_at: string;
}

export interface ExerciseLog {
  id: string;
  session_id: string;
  card_exercise_id: string;
  feel_note: string | null;
  created_at: string;
}

export interface SetLog {
  id: string;
  exercise_log_id: string;
  set_index: number;
  weight_kg: number | null;
  reps_done: number | null;
  hold_seconds_done: number | null;
  completed_at: string;
}

// --- 查詢時常用的組合型別 ---

/** 卡片內的動作 + 它引用的動作庫資料 */
export interface CardExerciseWithExercise extends CardExercise {
  exercise: Exercise;
}

/** 訓練卡 + 依 order_index 排好的動作清單 */
export interface WorkoutCardDetail extends WorkoutCard {
  card_exercises: CardExerciseWithExercise[];
}

/** 執行頁用：某動作的紀錄 + 已完成的組 */
export interface ExerciseLogWithSets extends ExerciseLog {
  set_logs: SetLog[];
}

// --- 顯示用小工具 ---

/** 把目標次數區間寫成可讀文字，例如 "8–12 下"、"10 下"、"30 秒" */
export function formatTarget(ce: CardExercise): string {
  if (ce.mode === "hold") {
    return ce.target_hold_seconds ? `${ce.target_hold_seconds} 秒` : "持續";
  }
  const { target_reps_min: min, target_reps_max: max } = ce;
  if (min && max) return min === max ? `${min} 下` : `${min}–${max} 下`;
  if (min) return `${min}+ 下`;
  if (max) return `≤ ${max} 下`;
  return "自訂";
}

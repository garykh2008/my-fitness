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

  // 預設訓練參數：加進訓練卡時直接複製過去，
  // 所以建卡時只要挑動作，不用每次重填組數次數。
  default_mode: ExerciseMode;
  default_sets: number | null;
  default_reps_min: number | null;
  default_reps_max: number | null;
  default_hold_seconds: number | null;
  default_tempo: string | null;
  default_rest_seconds: number | null;
}

/** 動作分類。順序就是動作庫裡的顯示順序。 */
export const CATEGORIES = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  chest: "胸",
  back: "背",
  shoulders: "肩",
  arms: "手臂",
  legs: "腿",
  core: "核心",
};

export function categoryLabel(c: string | null): string {
  if (!c) return "未分類";
  return CATEGORY_LABELS[c] ?? c;
}

/**
 * 把動作的預設值轉成 card_exercises 要寫入的欄位。
 * mode 與目標欄位必須對得起來，否則會撞上 DB 的 check constraint。
 */
export function cardExerciseDefaults(ex: Exercise) {
  const mode: ExerciseMode = ex.default_mode ?? "reps";
  return {
    mode,
    target_sets: ex.default_sets ?? 3,
    target_reps_min: mode === "reps" ? (ex.default_reps_min ?? 10) : null,
    target_reps_max: mode === "reps" ? (ex.default_reps_max ?? 15) : null,
    target_hold_seconds: mode === "hold" ? (ex.default_hold_seconds ?? 30) : null,
    tempo_text: ex.default_tempo,
    cue_text: null as string | null, // 沿用動作庫的 default_cue，不覆寫
    rest_seconds: ex.default_rest_seconds ?? 60,
  };
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

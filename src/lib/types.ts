// 對應 supabase/schema.sql 的資料模型（規格書第 2 節）

export type ExerciseMode = "reps" | "hold" | "interval";

/**
 * 三種訓練型態：
 *   reps     組數 × 次數（一般重訓）
 *   hold     撐住 N 秒（等長收縮、棒式）
 *   interval 做 N 秒，記錄實際做了幾下（follow-along 型的時間制課表）
 *
 * interval 跟 hold 的差別在「記什麼」：hold 記秒數，interval 記重量與次數。
 * 也因此 interval 沒有目標次數 —— 做幾下是結果，不是目標。
 */
export const MODE_LABELS: Record<ExerciseMode, string> = {
  reps: "次數型",
  hold: "持續秒數型",
  interval: "時間制",
};
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
  default_interval_seconds: number | null;
  default_tempo: string | null;
  default_rest_seconds: number | null;

  // 示意媒體。顯示優先序：media_path（自存，Phase 2）> media_url（外部連結）
  media_url: string | null;
  media_path: string | null;
  media_type: "image" | "video" | null;
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
    target_interval_seconds:
      mode === "interval" ? (ex.default_interval_seconds ?? 45) : null,
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
  target_interval_seconds: number | null;
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

/**
 * 預估這張卡要練多久（分鐘）。
 *
 * 每組的工作時間依 mode 推算，加上組間休息，再加上動作之間的轉換
 * （拿器材、調重量）。次數型用「上限次數 × 3 秒」估，那個 3 秒大致涵蓋
 * 一般的離心節奏；最後一組之後不再休息。
 *
 * 這是估計值不是承諾 —— 實際時長在紀錄頁會用真實資料算。
 */
export function estimateCardMinutes(exercises: CardExercise[]): number | null {
  if (exercises.length === 0) return null;

  let seconds = 0;
  for (const ce of exercises) {
    const sets = ce.target_sets ?? 3;

    let work: number;
    if (ce.mode === "hold") {
      work = ce.target_hold_seconds ?? 30;
    } else if (ce.mode === "interval") {
      work = ce.target_interval_seconds ?? 45;
    } else {
      work = (ce.target_reps_max ?? ce.target_reps_min ?? 12) * 3;
    }

    const rest = ce.rest_seconds ?? 60;
    seconds += sets * work + Math.max(0, sets - 1) * rest;
  }

  // 動作之間的轉換
  seconds += exercises.length * 45;

  return Math.max(1, Math.round(seconds / 60));
}

/** 把目標次數區間寫成可讀文字，例如 "8–12 下"、"10 下"、"30 秒" */
export function formatTarget(ce: CardExercise): string {
  if (ce.mode === "hold") {
    return ce.target_hold_seconds ? `${ce.target_hold_seconds} 秒` : "持續";
  }
  if (ce.mode === "interval") {
    return ce.target_interval_seconds
      ? `${ce.target_interval_seconds} 秒內盡量做`
      : "計時";
  }
  const { target_reps_min: min, target_reps_max: max } = ce;
  if (min && max) return min === max ? `${min} 下` : `${min}–${max} 下`;
  if (min) return `${min}+ 下`;
  if (max) return `≤ ${max} 下`;
  return "自訂";
}

import { assertCoachAuthorized, errorResponse } from "@/lib/coach-auth";
import { getAdminSupabase, ownerUserId } from "@/lib/supabase-admin";
import { formatTarget } from "@/lib/types";
import type { CardExercise, SetLog } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/coach/history?limit=5&exercise=啞鈴臥推
//
// 規格書第 3.3 節「匯出最近 N 次紀錄為結構化摘要」的自動版：
// 教練開下一張課表前，先讀這裡看上次練了什麼、用多重、感受如何。
//
// 輸出刻意攤平成好讀的形狀（動作名稱而非 uuid、目標寫成 "8-12 下"），
// 因為讀的人是語言模型，不是前端程式。

interface SessionRow {
  id: string;
  performed_at: string;
  overall_note: string | null;
  workout_cards: { title: string; thesis: string | null } | null;
  exercise_logs: {
    feel_note: string | null;
    card_exercises:
      | (CardExercise & { exercises: { name_zh: string } | null })
      | null;
    set_logs: SetLog[];
  }[];
}

const MAX_LIMIT = 30;

export async function GET(request: Request) {
  try {
    assertCoachAuthorized(request);

    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "5");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_LIMIT)
      : 5;
    const exerciseFilter = url.searchParams.get("exercise")?.trim() || null;

    const supabase = getAdminSupabase();
    const userId = await ownerUserId();

    const { data, error } = await supabase
      .from("workout_sessions")
      .select(
        `id, performed_at, overall_note,
         workout_cards ( title, thesis ),
         exercise_logs (
           feel_note,
           card_exercises ( *, exercises ( name_zh ) ),
           set_logs ( * )
         )`
      )
      .eq("user_id", userId)
      .order("performed_at", { ascending: false })
      .limit(limit)
      .returns<SessionRow[]>();

    if (error) throw new Error(`讀取訓練紀錄失敗：${error.message}`);

    const sessions = (data ?? []).map((s) => {
      const exercises = s.exercise_logs
        .map((log) => {
          const ce = log.card_exercises;
          const name = ce?.exercises?.name_zh ?? "(動作已刪除)";
          const sets = [...log.set_logs]
            .sort((a, b) => a.set_index - b.set_index)
            .map((sl) => {
              if (ce?.mode === "hold") {
                return { set: sl.set_index, hold_seconds: sl.hold_seconds_done };
              }
              // 時間制不記次數，只記重量；提前結束才會有實際秒數
              if (ce?.mode === "interval") {
                return {
                  set: sl.set_index,
                  weight_kg: sl.weight_kg,
                  ...(sl.hold_seconds_done != null
                    ? { seconds_done: sl.hold_seconds_done }
                    : {}),
                };
              }
              return {
                set: sl.set_index,
                weight_kg: sl.weight_kg,
                reps: sl.reps_done,
              };
            });

          return {
            name,
            order: ce?.order_index ?? 0,
            mode: ce?.mode ?? "reps",
            target: ce ? formatTarget(ce) : null,
            target_sets: ce?.target_sets ?? null,
            tempo: ce?.tempo_text ?? null,
            sets,
            feel_note: log.feel_note,
          };
        })
        .filter((e) => !exerciseFilter || e.name === exerciseFilter)
        .sort((a, b) => a.order - b.order)
        // order 只是用來排序，回傳時就不用給教練看了
        .map(({ order: _order, ...rest }) => rest);

      return {
        performed_at: s.performed_at,
        card_title: s.workout_cards?.title ?? null,
        card_thesis: s.workout_cards?.thesis ?? null,
        overall_note: s.overall_note,
        exercises,
      };
    });

    return Response.json({
      count: sessions.length,
      filtered_by_exercise: exerciseFilter,
      sessions,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

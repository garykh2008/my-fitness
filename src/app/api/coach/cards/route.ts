import { assertCoachAuthorized, errorResponse } from "@/lib/coach-auth";
import { BadRequest, int, str } from "@/lib/coach-input";
import { getAdminSupabase, ownerUserId } from "@/lib/supabase-admin";
import type { Exercise } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/coach/cards
//
// AI 教練一次送出整張訓練卡。刻意不拆成「先建動作、再建卡、再逐個加動作」，
// 因為教練吐出來的本來就是一整份菜單，拆成多次呼叫只會增加寫錯的機會。
//
// 動作庫裡沒有的動作會用 name_zh 自動建立；已存在的直接沿用（不會建重複的）。

interface ExerciseInput {
  name_zh?: unknown;
  name_en?: unknown;
  category?: unknown;
  equipment?: unknown;
  mode?: unknown;
  sets?: unknown;
  reps_min?: unknown;
  reps_max?: unknown;
  hold_seconds?: unknown;
  tempo?: unknown;
  cue?: unknown;
  rest_seconds?: unknown;
}

interface CardInput {
  title?: unknown;
  thesis?: unknown;
  source_note?: unknown;
  status?: unknown;
  exercises?: unknown;
}

export async function POST(request: Request) {
  try {
    assertCoachAuthorized(request);

    let body: CardInput;
    try {
      body = (await request.json()) as CardInput;
    } catch {
      throw new BadRequest("request body 不是合法的 JSON");
    }

    const title = str(body.title, "title", true)!;
    const thesis = str(body.thesis, "thesis");
    const sourceNote = str(body.source_note, "source_note");

    const statusRaw = str(body.status, "status") ?? "active";
    if (!["draft", "active", "archived"].includes(statusRaw)) {
      throw new BadRequest("status 必須是 draft / active / archived 其中之一");
    }

    if (!Array.isArray(body.exercises) || body.exercises.length === 0) {
      throw new BadRequest("exercises 必須是至少一個元素的陣列");
    }

    // --- 先把輸入整理乾淨，全部驗證過再開始寫入 ---
    //
    // mode 刻意保留 null（＝教練沒指定），等查到動作之後再用動作庫的
    // default_mode 補。直接預設成 "reps" 會把棒式這種 hold 型動作弄錯。
    const items = (body.exercises as ExerciseInput[]).map((raw, i) => {
      const where = `exercises[${i}]`;
      const name = str(raw.name_zh, `${where}.name_zh`, true)!;

      const modeRaw = str(raw.mode, `${where}.mode`);
      if (modeRaw !== null && modeRaw !== "reps" && modeRaw !== "hold") {
        throw new BadRequest(`${where}.mode 必須是 reps 或 hold`);
      }

      const repsMin = int(raw.reps_min, `${where}.reps_min`);
      const repsMax = int(raw.reps_max, `${where}.reps_max`);
      const holdSeconds = int(raw.hold_seconds, `${where}.hold_seconds`);

      if (repsMin !== null && repsMax !== null && repsMin > repsMax) {
        throw new BadRequest(`${where}.reps_min 不可大於 reps_max`);
      }

      return {
        name,
        name_en: str(raw.name_en, `${where}.name_en`),
        category: str(raw.category, `${where}.category`),
        equipment: str(raw.equipment, `${where}.equipment`),
        mode: modeRaw as "reps" | "hold" | null,
        sets: int(raw.sets, `${where}.sets`),
        repsMin,
        repsMax,
        holdSeconds,
        tempo: str(raw.tempo, `${where}.tempo`),
        cue: str(raw.cue, `${where}.cue`),
        rest: int(raw.rest_seconds, `${where}.rest_seconds`),
        where,
      };
    });

    const supabase = getAdminSupabase();
    const userId = await ownerUserId();

    // --- 動作庫：已存在的沿用，沒有的建立 ---
    const names = [...new Set(items.map((it) => it.name))];
    const { data: existing, error: exErr } = await supabase
      .from("exercises")
      .select("*")
      .eq("user_id", userId)
      .in("name_zh", names)
      .returns<Exercise[]>();

    if (exErr) throw new Error(`查詢動作庫失敗：${exErr.message}`);

    const byName = new Map((existing ?? []).map((e) => [e.name_zh, e]));
    const missing = names.filter((n) => !byName.has(n));
    const createdExerciseIds: string[] = [];

    if (missing.length > 0) {
      const rows = missing.map((name) => {
        const it = items.find((x) => x.name === name)!;
        const mode = it.mode ?? "reps";
        return {
          user_id: userId,
          name_zh: name,
          name_en: it.name_en,
          category: it.category,
          default_equipment: it.equipment,
          default_cue: it.cue,
          // 新建的動作也要有預設值，下次開課表才不用再填一次
          default_mode: mode,
          default_sets: it.sets ?? 3,
          default_reps_min: mode === "reps" ? (it.repsMin ?? 10) : null,
          default_reps_max: mode === "reps" ? (it.repsMax ?? 15) : null,
          default_hold_seconds: mode === "hold" ? (it.holdSeconds ?? 30) : null,
          default_tempo: it.tempo,
          default_rest_seconds: it.rest ?? 60,
        };
      });

      const { data: inserted, error } = await supabase
        .from("exercises")
        .insert(rows)
        .select("*")
        .returns<Exercise[]>();

      if (error) throw new Error(`建立動作失敗：${error.message}`);

      for (const e of inserted ?? []) {
        byName.set(e.name_zh, e);
        createdExerciseIds.push(e.id);
      }
    }

    // --- 建卡 ---
    const { data: card, error: cardErr } = await supabase
      .from("workout_cards")
      .insert({
        user_id: userId,
        title,
        thesis,
        source_note: sourceNote,
        status: statusRaw,
      })
      .select("id, title, status, created_at")
      .single<{ id: string; title: string; status: string; created_at: string }>();

    if (cardErr || !card) throw new Error(`建立訓練卡失敗：${cardErr?.message}`);

    // --- 卡內動作（順序就是陣列順序）---
    // 教練沒指定的細項，用動作庫裡的預設值補 ——
    // 這樣「只給動作名稱」也能開出一張參數完整的卡。
    const rows = items.map((it, i) => {
      const ex = byName.get(it.name)!;
      const mode = it.mode ?? ex.default_mode ?? "reps";

      if (mode === "hold" && (it.holdSeconds ?? ex.default_hold_seconds) == null) {
        throw new BadRequest(`${it.where} 是 hold 型，必須提供 hold_seconds`);
      }

      return {
        workout_card_id: card.id,
        exercise_id: ex.id,
        order_index: i,
        mode,
        target_sets: it.sets ?? ex.default_sets ?? 3,
        // mode 與目標欄位要對得起來，否則會踩到 DB 的 check constraint
        target_reps_min:
          mode === "reps" ? (it.repsMin ?? ex.default_reps_min ?? 10) : null,
        target_reps_max:
          mode === "reps" ? (it.repsMax ?? ex.default_reps_max ?? 15) : null,
        target_hold_seconds:
          mode === "hold" ? (it.holdSeconds ?? ex.default_hold_seconds ?? 30) : null,
        tempo_text: it.tempo ?? ex.default_tempo,
        cue_text: it.cue,
        rest_seconds: it.rest ?? ex.default_rest_seconds ?? 60,
      };
    });

    const { error: ceErr } = await supabase.from("card_exercises").insert(rows);

    if (ceErr) {
      // 不要留下一張空卡跟一堆孤兒動作
      await supabase.from("workout_cards").delete().eq("id", card.id);
      if (createdExerciseIds.length > 0) {
        await supabase.from("exercises").delete().in("id", createdExerciseIds);
      }
      throw new Error(`加入卡片動作失敗：${ceErr.message}`);
    }

    const base = process.env.APP_BASE_URL ?? "";

    return Response.json(
      {
        id: card.id,
        title: card.title,
        status: card.status,
        created_at: card.created_at,
        exercise_count: items.length,
        created_exercises: missing,
        url: base ? `${base}/cards/${card.id}` : `/cards/${card.id}`,
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof BadRequest) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    return errorResponse(e);
  }
}

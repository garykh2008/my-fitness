import { assertCoachAuthorized, errorResponse } from "@/lib/coach-auth";
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

class BadRequest extends Error {}

function str(v: unknown, field: string, required = false): string | null {
  if (v === undefined || v === null || v === "") {
    if (required) throw new BadRequest(`缺少必填欄位 ${field}`);
    return null;
  }
  if (typeof v !== "string") throw new BadRequest(`${field} 必須是字串`);
  const t = v.trim();
  if (t === "") {
    if (required) throw new BadRequest(`${field} 不可為空白`);
    return null;
  }
  return t;
}

function int(v: unknown, field: string): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new BadRequest(`${field} 必須是數字`);
  if (!Number.isInteger(n)) throw new BadRequest(`${field} 必須是整數`);
  if (n < 0) throw new BadRequest(`${field} 不可為負數`);
  return n;
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
    const items = (body.exercises as ExerciseInput[]).map((raw, i) => {
      const where = `exercises[${i}]`;
      const name = str(raw.name_zh, `${where}.name_zh`, true)!;

      const modeRaw = str(raw.mode, `${where}.mode`) ?? "reps";
      if (modeRaw !== "reps" && modeRaw !== "hold") {
        throw new BadRequest(`${where}.mode 必須是 reps 或 hold`);
      }

      const repsMin = int(raw.reps_min, `${where}.reps_min`);
      const repsMax = int(raw.reps_max, `${where}.reps_max`);
      const holdSeconds = int(raw.hold_seconds, `${where}.hold_seconds`);

      if (repsMin !== null && repsMax !== null && repsMin > repsMax) {
        throw new BadRequest(`${where}.reps_min 不可大於 reps_max`);
      }
      if (modeRaw === "hold" && holdSeconds === null) {
        throw new BadRequest(`${where} 是 hold 型，必須提供 hold_seconds`);
      }

      return {
        name,
        name_en: str(raw.name_en, `${where}.name_en`),
        category: str(raw.category, `${where}.category`),
        equipment: str(raw.equipment, `${where}.equipment`),
        mode: modeRaw,
        // DB 的 check constraint 要求 mode 與目標欄位對得起來，這裡先清乾淨
        target_sets: int(raw.sets, `${where}.sets`),
        target_reps_min: modeRaw === "reps" ? repsMin : null,
        target_reps_max: modeRaw === "reps" ? repsMax : null,
        target_hold_seconds: modeRaw === "hold" ? holdSeconds : null,
        tempo_text: str(raw.tempo, `${where}.tempo`),
        cue_text: str(raw.cue, `${where}.cue`),
        rest_seconds: int(raw.rest_seconds, `${where}.rest_seconds`),
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
        return {
          user_id: userId,
          name_zh: name,
          name_en: it.name_en,
          category: it.category,
          default_equipment: it.equipment,
          default_cue: it.cue_text,
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
    const { error: ceErr } = await supabase.from("card_exercises").insert(
      items.map((it, i) => ({
        workout_card_id: card.id,
        exercise_id: byName.get(it.name)!.id,
        order_index: i,
        mode: it.mode,
        target_sets: it.target_sets,
        target_reps_min: it.target_reps_min,
        target_reps_max: it.target_reps_max,
        target_hold_seconds: it.target_hold_seconds,
        tempo_text: it.tempo_text,
        cue_text: it.cue_text,
        rest_seconds: it.rest_seconds,
      }))
    );

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

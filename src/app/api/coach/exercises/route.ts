import { assertCoachAuthorized, errorResponse } from "@/lib/coach-auth";
import { BadRequest, str } from "@/lib/coach-input";
import { getAdminSupabase, ownerUserId } from "@/lib/supabase-admin";
import type { Exercise } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/coach/exercises
//
// 讓教練先看動作庫裡已經有什麼，開課表時沿用既有名稱，
// 避免「啞鈴臥推」跟「啞鈴平板臥推」被當成兩個不同動作，害趨勢圖斷掉。

export async function GET(request: Request) {
  try {
    assertCoachAuthorized(request);

    const supabase = getAdminSupabase();
    const userId = await ownerUserId();

    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("user_id", userId)
      .order("category", { ascending: true, nullsFirst: false })
      .order("name_zh", { ascending: true })
      .returns<Exercise[]>();

    if (error) throw new Error(`讀取動作庫失敗：${error.message}`);

    return Response.json({
      count: data?.length ?? 0,
      exercises: (data ?? []).map((e) => ({
        name_zh: e.name_zh,
        name_en: e.name_en,
        category: e.category,
        equipment: e.default_equipment,
        default_cue: e.default_cue,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST /api/coach/exercises
//
// 一次補一批動作進動作庫（不綁訓練卡）。開課表時雖然也會順手建立缺的動作，
// 但那條路徑只認得 name_zh，補不了 notes，也沒辦法在還沒決定要怎麼練之前
// 先把動作庫鋪好 —— 這支就是為了後者。
//
// 以 name_zh 判斷重複：已經存在的直接跳過而不是覆蓋，
// 免得把手動調過的 cue 洗掉。重跑同一份清單是安全的。

interface NewExerciseInput {
  name_zh?: unknown;
  name_en?: unknown;
  category?: unknown;
  equipment?: unknown;
  default_cue?: unknown;
  notes?: unknown;
}

export async function POST(request: Request) {
  try {
    assertCoachAuthorized(request);

    let body: { exercises?: unknown };
    try {
      body = (await request.json()) as { exercises?: unknown };
    } catch {
      throw new BadRequest("request body 不是合法的 JSON");
    }

    if (!Array.isArray(body.exercises) || body.exercises.length === 0) {
      throw new BadRequest("exercises 必須是至少一個元素的陣列");
    }

    // 全部驗完才動手寫，避免寫到一半才發現第 20 筆有問題
    const items = (body.exercises as NewExerciseInput[]).map((raw, i) => {
      const where = `exercises[${i}]`;
      return {
        name_zh: str(raw.name_zh, `${where}.name_zh`, true)!,
        name_en: str(raw.name_en, `${where}.name_en`),
        category: str(raw.category, `${where}.category`),
        default_equipment: str(raw.equipment, `${where}.equipment`),
        default_cue: str(raw.default_cue, `${where}.default_cue`),
        notes: str(raw.notes, `${where}.notes`),
      };
    });

    // 同一份請求裡自己重複的，留第一筆就好
    const deduped = [...new Map(items.map((it) => [it.name_zh, it])).values()];

    const supabase = getAdminSupabase();
    const userId = await ownerUserId();

    const { data: existing, error: exErr } = await supabase
      .from("exercises")
      .select("name_zh")
      .eq("user_id", userId)
      .in(
        "name_zh",
        deduped.map((it) => it.name_zh)
      )
      .returns<{ name_zh: string }[]>();

    if (exErr) throw new Error(`查詢動作庫失敗：${exErr.message}`);

    const already = new Set((existing ?? []).map((e) => e.name_zh));
    const toInsert = deduped.filter((it) => !already.has(it.name_zh));

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("exercises")
        .insert(toInsert.map((it) => ({ user_id: userId, ...it })));

      if (error) throw new Error(`建立動作失敗：${error.message}`);
    }

    return Response.json(
      {
        created: toInsert.map((it) => it.name_zh),
        skipped: deduped.filter((it) => already.has(it.name_zh)).map((it) => it.name_zh),
        created_count: toInsert.length,
      },
      { status: toInsert.length > 0 ? 201 : 200 }
    );
  } catch (e) {
    if (e instanceof BadRequest) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    return errorResponse(e);
  }
}

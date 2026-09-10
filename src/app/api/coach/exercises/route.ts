import { assertCoachAuthorized, errorResponse } from "@/lib/coach-auth";
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

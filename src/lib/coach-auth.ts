import { timingSafeEqual } from "node:crypto";

// AI 教練 API 的驗證。
//
// 瀏覽器走 Supabase Auth 的 cookie session，但教練是機器呼叫、沒有 session，
// 所以改用一組靜態 bearer token（COACH_API_TOKEN）。
//
// 沒設定 token 時整組 /api/coach/* 一律回 503 —— fail closed，
// 避免有人忘了設定就把端點裸奔在公開網址上。

export class CoachAuthError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual 要求等長，長度不同直接判否（長度本身不是機密）
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** 驗證請求的 Authorization header。不通過就丟 CoachAuthError。 */
export function assertCoachAuthorized(request: Request): void {
  const expected = process.env.COACH_API_TOKEN;

  if (!expected || expected.length < 24) {
    throw new CoachAuthError(
      "教練 API 尚未啟用：伺服器未設定 COACH_API_TOKEN（或長度不足 24 字元）。",
      503
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());

  if (!match || !safeEqual(match[1], expected)) {
    throw new CoachAuthError("未授權。", 401);
  }
}

/** 把錯誤轉成 JSON 回應，順便統一錯誤格式。 */
export function errorResponse(e: unknown): Response {
  if (e instanceof CoachAuthError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : "未知錯誤";
  return Response.json({ error: message }, { status: 500 });
}

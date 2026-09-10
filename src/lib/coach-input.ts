// /api/coach/* 的輸入驗證小工具。
//
// 教練 API 收到的是機器產生的 JSON，欄位型別不保證正確，所以一律當 unknown 進來、
// 驗過再用。錯誤訊息裡會帶欄位路徑（例如 exercises[2].sets），
// 這樣模型看到 400 就能自己修正後重試，不用人介入。

export class BadRequest extends Error {}

/** 取字串欄位。空字串視為未填；required 時未填直接丟 BadRequest。 */
export function str(v: unknown, field: string, required = false): string | null {
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

/** 取非負整數欄位。未填回 null。 */
export function int(v: unknown, field: string): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new BadRequest(`${field} 必須是數字`);
  if (!Number.isInteger(n)) throw new BadRequest(`${field} 必須是整數`);
  if (n < 0) throw new BadRequest(`${field} 不可為負數`);
  return n;
}

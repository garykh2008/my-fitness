// 動作示意媒體的網址處理。
//
// 目前只特別支援 YouTube（能取縮圖、能嵌入），其餘網址一律當成單純的外連。
// 之後補自存媒體時，顯示端優先用 media_path，這裡的邏輯不受影響。

export type Media =
  | { kind: "youtube"; id: string; start: number | null }
  | { kind: "link"; url: string };

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** YouTube 影片 id 固定是 11 碼的 base64url 字元 */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** 把 "90"、"1m30s"、"2h3m4s" 這類時間戳換算成秒；認不得就回 null */
function parseStart(raw: string | null): number | null {
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(raw);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;

  const total =
    Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

/**
 * 解析使用者貼進來的網址。
 * 認得 watch?v= / youtu.be/ / shorts/ / embed/ / live/，也會帶出 t= 時間戳。
 * 不是合法網址就回 null（讓 UI 當作沒填）。
 */
export function parseMediaUrl(raw: string | null | undefined): Media | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  let u: URL;
  try {
    // 使用者常常只貼 "youtu.be/xxx" 這種沒有協定的形式
    u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const host = u.hostname.toLowerCase();

  // 沒有點的主機名不是對外網址。少了這道，打錯字（例如直接貼了動作名稱）
  // 會被 new URL() 當成 IDN 主機而變成一個點了沒反應的連結。
  if (!host.includes(".")) return null;
  const start = parseStart(u.searchParams.get("t") ?? u.searchParams.get("start"));

  // youtu.be/<id>
  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (ID_RE.test(id)) return { kind: "youtube", id, start };
    return { kind: "link", url: u.toString() };
  }

  if (YT_HOSTS.has(host)) {
    const v = u.searchParams.get("v");
    if (v && ID_RE.test(v)) return { kind: "youtube", id: v, start };

    // /shorts/<id>、/embed/<id>、/live/<id>
    const seg = u.pathname.split("/").filter(Boolean);
    if (
      seg.length >= 2 &&
      ["shorts", "embed", "live", "v"].includes(seg[0]) &&
      ID_RE.test(seg[1])
    ) {
      return { kind: "youtube", id: seg[1], start };
    }

    return { kind: "link", url: u.toString() };
  }

  return { kind: "link", url: u.toString() };
}

/** 縮圖。hqdefault 每支影片都有，maxres 不保證存在。 */
export function youtubeThumb(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/** 嵌入網址。用 nocookie 網域，播放前不會種追蹤 cookie。 */
export function youtubeEmbed(id: string, start: number | null): string {
  const params = new URLSearchParams({ autoplay: "1", rel: "0" });
  if (start) params.set("start", String(start));
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/**
 * 沒有示範連結時給的搜尋網址。
 *
 * 刻意不去猜一個影片 id 填進資料庫：猜出來的多半是死連結或不相干的影片，
 * 而健身動作看到錯的示範比沒有示範更糟。搜尋永遠有效，也永遠是使用者自己挑。
 */
export function youtubeSearchUrl(nameZh: string, nameEn?: string | null): string {
  const q = [nameZh, nameEn, "教學"].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

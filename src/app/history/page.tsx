import Link from "next/link";
import { listSessions } from "@/lib/queries";
import Nav from "../Nav";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 容器有設 TZ=Asia/Taipei，所以這裡的日期就是台北時間 */
function formatDate(iso: string): { date: string; weekday: string } {
  const d = new Date(iso);
  return {
    date: `${d.getMonth() + 1}/${d.getDate()}`,
    weekday: `週${WEEKDAYS[d.getDay()]}`,
  };
}

export default async function HistoryPage() {
  const sessions = await listSessions();

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>訓練紀錄</h1>
          <div className="sub">
            {sessions.length > 0
              ? `${sessions.length} 次訓練`
              : "還沒有紀錄"}
          </div>
        </div>
      </div>

      <Nav />

      {sessions.length === 0 && (
        <div className="empty">
          還沒有任何訓練紀錄。
          <br />
          開一張訓練卡、按「開始訓練」，記下第一組就會出現在這裡。
        </div>
      )}

      {sessions.map((s) => {
        const { date, weekday } = formatDate(s.performed_at);
        return (
          <Link key={s.id} href={`/history/${s.id}`} className="card-link">
            <article className="card session-row">
              <div className="session-date">
                <span className="session-day">{date}</span>
                <span className="session-weekday">{weekday}</span>
              </div>

              <div className="session-main">
                <div className="ex-title">{s.card_title ?? "（卡片已刪除）"}</div>
                <div className="ex-defaults">
                  {s.exerciseCount} 個動作 · {s.setCount} 組
                </div>
                {s.overall_note && (
                  <p className="thesis session-note">{s.overall_note}</p>
                )}
              </div>
            </article>
          </Link>
        );
      })}
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionDetail } from "@/lib/queries";
import { formatTarget } from "@/lib/types";

export const dynamic = "force-dynamic";

// 單次訓練的唯讀回顧。
//
// 刻意不重用 /train/<id>：那頁有計時器、螢幕常亮、結束與放棄按鈕，
// 拿來翻舊帳很怪。想改資料的話底部有連結過去。

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const detail = await getSessionDetail(sessionId);
  if (!detail) notFound();

  const { session, card, logs, durationMinutes } = detail;
  const performed = new Date(session.performed_at);

  const totalSets = [...logs.values()].reduce(
    (n, l) => n + l.set_logs.length,
    0
  );

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <div className="eyebrow">
            {performed.toLocaleDateString("zh-TW")}{" "}
            {performed.toLocaleTimeString("zh-TW", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <h1>{card.title}</h1>
          <div className="sub">
            {totalSets} 組
            {durationMinutes !== null && <> · 練了 {durationMinutes} 分鐘</>}
          </div>
        </div>
        <Link href="/history">
          <button className="btn ghost small" type="button">
            返回
          </button>
        </Link>
      </div>

      {session.overall_note && (
        <div className="notice info">{session.overall_note}</div>
      )}

      {card.card_exercises.map((ce, i) => {
        const log = logs.get(ce.id);
        const sets = log?.set_logs ?? [];

        // 那天沒做的動作也列出來，但標示清楚 —— 「這次跳過了什麼」本身是資訊
        return (
          <article className={`card${sets.length === 0 ? " skipped" : ""}`} key={ce.id}>
            <h2>
              <span className="ex-idx">{String(i + 1).padStart(2, "0")}</span>{" "}
              {ce.exercise.name_zh}
            </h2>

            <div>
              <span className="chip mode">
                {ce.target_sets ? `目標 ${ce.target_sets} 組 × ` : ""}
                {formatTarget(ce)}
              </span>
            </div>

            {sets.length === 0 ? (
              <p className="thesis" style={{ marginTop: 10 }}>
                這次沒有記錄
              </p>
            ) : (
              <div className="done-sets">
                {sets.map((s) => (
                  <span className="done-set" key={s.id}>
                    <span className="done-set-no">{s.set_index}</span>
                    {ce.mode === "hold" ? (
                      `${s.hold_seconds_done ?? "—"} 秒`
                    ) : ce.mode === "interval" ? (
                      <>
                        {s.weight_kg ?? "—"} kg
                        {s.hold_seconds_done != null && (
                          <span className="set-partial">
                            {" "}
                            · {s.hold_seconds_done} 秒
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {s.weight_kg ?? "—"} kg × {s.reps_done ?? "—"}
                      </>
                    )}
                  </span>
                ))}
              </div>
            )}

            {log?.feel_note && <p className="cue">{log.feel_note}</p>}
          </article>
        );
      })}

      <Link href={`/train/${session.id}`}>
        <button className="btn ghost" type="button">
          繼續編輯這次訓練
        </button>
      </Link>
    </main>
  );
}

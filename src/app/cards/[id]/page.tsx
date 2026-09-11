import Link from "next/link";
import { notFound } from "next/navigation";
import { getCardDetail, getLatestSession } from "@/lib/queries";
import { formatTarget, estimateCardMinutes } from "@/lib/types";
import { startSession } from "../actions";

export const dynamic = "force-dynamic";

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getCardDetail(id);
  if (!card) notFound();

  const latest = await getLatestSession(id);
  const estimate = estimateCardMinutes(card.card_exercises);

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>{card.title}</h1>
          {latest && (
            <div className="sub">
              上次練習：
              {new Date(latest.performed_at).toLocaleDateString("zh-TW")}
            </div>
          )}
        </div>
        <Link href="/">
          <button className="btn ghost small" type="button">
            返回
          </button>
        </Link>
      </div>

      {card.thesis && <div className="notice info">{card.thesis}</div>}

      {card.card_exercises.length > 0 && (
        <div className="meta-row">
          <span className="chip">
            {card.card_exercises.length} 個動作
          </span>
          <span className="chip">
            {card.card_exercises.reduce((n, ce) => n + (ce.target_sets ?? 3), 0)} 組
          </span>
          {estimate && <span className="chip mode">約 {estimate} 分鐘</span>}
        </div>
      )}

      {card.card_exercises.length === 0 && (
        <div className="empty">
          這張卡還沒有動作。
          <br />
          按下面的「編輯卡片」把動作加進來。
        </div>
      )}

      {card.card_exercises.map((ce, i) => (
        <article className="card" key={ce.id}>
          <h2>
            <span className="ex-idx">{String(i + 1).padStart(2, "0")}</span>{" "}
            {ce.exercise.name_zh}
          </h2>
          <div>
            <span className="chip mode">
              {ce.target_sets ? `${ce.target_sets} 組 × ` : ""}
              {formatTarget(ce)}
            </span>
            {ce.tempo_text && <span className="chip tempo">{ce.tempo_text}</span>}
            {ce.rest_seconds && (
              <span className="chip">休息 {ce.rest_seconds}s</span>
            )}
          </div>
          {(ce.cue_text || ce.exercise.default_cue) && (
            <p className="cue">
              {ce.cue_text || ce.exercise.default_cue}
            </p>
          )}
        </article>
      ))}

      {card.card_exercises.length > 0 && (
        <form action={startSession}>
          <input type="hidden" name="workout_card_id" value={card.id} />
          <button className="btn primary" type="submit">
            開始訓練
          </button>
        </form>
      )}

      <Link href={`/cards/${card.id}/edit`}>
        <button className="btn ghost" type="button" style={{ marginTop: 8 }}>
          編輯卡片
        </button>
      </Link>
    </main>
  );
}

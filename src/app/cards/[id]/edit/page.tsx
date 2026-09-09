import Link from "next/link";
import { notFound } from "next/navigation";
import { getCardDetail, listExercises } from "@/lib/queries";
import CardEditor from "./CardEditor";

export const dynamic = "force-dynamic";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [card, exercises] = await Promise.all([
    getCardDetail(id),
    listExercises(),
  ]);
  if (!card) notFound();

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>編輯訓練卡</h1>
          <div className="sub">順序就是訓練邏輯，可以上下調整</div>
        </div>
        <Link href={`/cards/${card.id}`}>
          <button className="btn ghost small" type="button">
            完成
          </button>
        </Link>
      </div>

      {exercises.length === 0 && (
        <div className="notice info">
          動作庫是空的，要先到 <Link href="/exercises">動作庫</Link> 建立動作，
          才能加進這張卡。
        </div>
      )}

      <CardEditor card={card} exercises={exercises} />
    </main>
  );
}

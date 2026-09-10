import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { signOut } from "./login/actions";
import Nav from "./Nav";
import ArchivedCards from "./ArchivedCards";
import type { WorkoutCard } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await getSupabase();

  // 一次拿回來再分組，省一趟往返
  const { data: all, error } = await supabase
    .from("workout_cards")
    .select("*")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .returns<WorkoutCard[]>();

  const cards = all?.filter((c) => c.status === "active") ?? [];
  const archived = all?.filter((c) => c.status === "archived") ?? [];

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>訓練卡</h1>
          <div className="sub">選一張，開始今天的訓練</div>
        </div>
        <form action={signOut}>
          <button className="btn ghost small" type="submit">
            登出
          </button>
        </form>
      </div>

      <Nav />

      {error && (
        <div className="notice error">
          讀取訓練卡失敗：{error.message}
        </div>
      )}

      {!error && cards.length === 0 && (
        <div className="empty">
          還沒有訓練卡。
          <br />
          跟 Claude 討論出菜單後，回來建立第一張。
        </div>
      )}

      {cards.map((card) => (
        <Link key={card.id} href={`/cards/${card.id}`} className="card-link">
          <article className="card">
            <h2>{card.title}</h2>
            {card.thesis && <p className="thesis">{card.thesis}</p>}
            <div className="meta">
              建立於 {new Date(card.created_at).toLocaleDateString("zh-TW")}
            </div>
          </article>
        </Link>
      ))}

      <Link href="/cards/new">
        <button className="btn" type="button">
          ＋ 新增訓練卡
        </button>
      </Link>

      <ArchivedCards cards={archived} />
    </main>
  );
}

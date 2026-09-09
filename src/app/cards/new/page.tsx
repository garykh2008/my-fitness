import Link from "next/link";
import NewCardForm from "./NewCardForm";

export default function NewCardPage() {
  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>新增訓練卡</h1>
          <div className="sub">先寫標題與邏輯，下一步再加動作</div>
        </div>
        <Link href="/">
          <button className="btn ghost small" type="button">
            取消
          </button>
        </Link>
      </div>

      <article className="card">
        <NewCardForm />
      </article>
    </main>
  );
}

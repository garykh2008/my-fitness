"use client";

import Link from "next/link";
import { useState } from "react";
import { unarchiveCard } from "./cards/actions";
import type { WorkoutCard } from "@/lib/types";

// 封存的卡要看得到、拿得回來，否則「封存」跟「刪掉」在使用者眼裡沒有差別，
// 那它就真的沒有意義了。預設收合，不干擾正在用的卡片。

export default function ArchivedCards({ cards }: { cards: WorkoutCard[] }) {
  const [open, setOpen] = useState(false);

  if (cards.length === 0) return null;

  return (
    <section className="archived">
      <button
        type="button"
        className="archived-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>已封存 {cards.length}</span>
        <span className="archived-caret">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <>
          <div className="archived-hint">
            訓練紀錄都還在，取消封存就會回到上面的列表。
          </div>

          {cards.map((card) => (
            <article className="card archived-row" key={card.id}>
              <Link href={`/cards/${card.id}`} className="archived-main">
                <div className="ex-title">{card.title}</div>
                {card.thesis && <p className="thesis">{card.thesis}</p>}
              </Link>
              <form action={unarchiveCard}>
                <input type="hidden" name="id" value={card.id} />
                <button className="btn ghost small" type="submit">
                  取消封存
                </button>
              </form>
            </article>
          ))}
        </>
      )}
    </section>
  );
}

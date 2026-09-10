"use client";

import { useState } from "react";
import { archiveCard, deleteCard } from "../../actions";
import type { CardStats } from "@/lib/queries";

// 封存 vs 刪除，差別只有一件事：訓練紀錄要不要一起消失。
//
// workout_sessions 對 workout_cards 是 on delete cascade，所以刪掉一張卡
// 會把它底下的每一次訓練、每一組重量都帶走。封存則是原封不動留著，
// 只是不再出現在訓練卡列表裡。
//
// 因此刪除前一定要先把「會失去什麼」講清楚，有紀錄的卡還要再確認一次。

export default function DangerZone({
  cardId,
  stats,
}: {
  cardId: string;
  stats: CardStats;
}) {
  const [confirming, setConfirming] = useState(false);
  const hasHistory = stats.sessionCount > 0;

  return (
    <section className="danger">
      <div className="subhead">收尾</div>

      <div className="danger-explain">
        <strong>封存</strong>：從訓練卡列表隱藏，
        <em>訓練紀錄完整保留</em>，隨時可以取消封存。
        <br />
        <strong>刪除</strong>：連同這張卡的所有訓練紀錄一起消失，無法復原。
      </div>

      <form action={archiveCard}>
        <input type="hidden" name="id" value={cardId} />
        <button className="btn ghost" type="submit">
          封存這張卡
        </button>
      </form>

      {!confirming ? (
        <button
          className="btn ghost danger-btn"
          type="button"
          onClick={() => setConfirming(true)}
        >
          刪除這張卡
        </button>
      ) : (
        <div className="danger-confirm">
          {hasHistory ? (
            <>
              <div className="notice error">
                這張卡有 <strong>{stats.sessionCount} 次訓練紀錄</strong>
                （共 {stats.setCount} 組）
                {stats.lastPerformedAt && (
                  <>
                    ，最近一次是{" "}
                    {new Date(stats.lastPerformedAt).toLocaleDateString("zh-TW")}
                  </>
                )}
                。刪除會把這些紀錄一起帶走，<strong>無法復原</strong>。
                <br />
                只是不想再看到它的話，用「封存」就好。
              </div>
            </>
          ) : (
            <div className="notice info">
              這張卡還沒有任何訓練紀錄，刪掉不會損失資料。
            </div>
          )}

          <div className="editor-actions">
            <form action={deleteCard} style={{ flex: 1 }}>
              <input type="hidden" name="id" value={cardId} />
              <button className="btn danger-solid" type="submit">
                {hasHistory ? "仍要刪除，連同紀錄" : "確定刪除"}
              </button>
            </form>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setConfirming(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

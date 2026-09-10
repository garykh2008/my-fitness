"use client";

import { useMemo, useState, useTransition } from "react";
import { quickAddCardExercise } from "../../actions";
import { CATEGORIES, categoryLabel } from "@/lib/types";
import type { Exercise } from "@/lib/types";

// 加入動作＝挑一個就好。
//
// 組數／次數／休息這些細項，動作庫裡已經有一組合理的預設值，加進來直接套用。
// 建卡的當下該想的是「練哪些、什麼順序」，不是每個動作重填一次表單。

function summarise(ex: Exercise): string {
  const sets = ex.default_sets ?? 3;
  const target =
    ex.default_mode === "hold"
      ? `${ex.default_hold_seconds ?? 30} 秒`
      : `${ex.default_reps_min ?? 10}–${ex.default_reps_max ?? 15} 下`;
  return `${sets} 組 × ${target}`;
}

export default function ExercisePicker({
  cardId,
  exercises,
  usedExerciseIds,
  onClose,
}: {
  cardId: string;
  exercises: Exercise[];
  usedExerciseIds: string[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const used = useMemo(() => new Set(usedExerciseIds), [usedExerciseIds]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ex of exercises) {
      const k = ex.category ?? "";
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [exercises]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (filter !== null && (ex.category ?? "") !== filter) return false;
      if (!q) return true;
      return (
        ex.name_zh.toLowerCase().includes(q) ||
        (ex.name_en ?? "").toLowerCase().includes(q) ||
        (ex.default_equipment ?? "").toLowerCase().includes(q)
      );
    });
  }, [exercises, filter, query]);

  const add = (ex: Exercise) => {
    setAddingId(ex.id);
    const fd = new FormData();
    fd.set("workout_card_id", cardId);
    fd.set("exercise_id", ex.id);
    startTransition(async () => {
      await quickAddCardExercise(fd);
      setAddingId(null);
    });
  };

  return (
    <article className="card picker">
      <div className="picker-head">
        <strong>加入動作</strong>
        <button className="btn ghost small" type="button" onClick={onClose}>
          完成
        </button>
      </div>

      <div className="filter-bar">
        <button
          type="button"
          className={`chip-btn${filter === null ? " on" : ""}`}
          onClick={() => setFilter(null)}
        >
          全部
        </button>
        {CATEGORIES.filter((c) => counts[c]).map((c) => (
          <button
            key={c}
            type="button"
            className={`chip-btn${filter === c ? " on" : ""}`}
            onClick={() => setFilter(filter === c ? null : c)}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>

      <div className="field search-field">
        <input
          type="search"
          placeholder="搜尋動作…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {visible.length === 0 && <div className="empty">沒有符合的動作。</div>}

      <div className="picker-list">
        {visible.map((ex) => (
          <button
            key={ex.id}
            type="button"
            className={`picker-item${used.has(ex.id) ? " used" : ""}`}
            onClick={() => add(ex)}
            disabled={addingId === ex.id}
          >
            <span className="picker-main">
              <span className="picker-name">
                {ex.name_zh}
                {used.has(ex.id) && <span className="picker-used">已在卡片中</span>}
              </span>
              <span className="picker-sub">
                {summarise(ex)}
                {ex.default_equipment ? ` · ${ex.default_equipment}` : ""}
              </span>
            </span>
            <span className="picker-add">{addingId === ex.id ? "…" : "＋"}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

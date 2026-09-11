"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createExercise, updateExercise, deleteExercise } from "./actions";
import { CATEGORIES, categoryLabel, MODE_LABELS } from "@/lib/types";
import type { ExerciseMode } from "@/lib/types";
import MediaPreview from "../MediaPreview";
import type { Exercise } from "@/lib/types";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? "儲存中…" : label}
    </button>
  );
}

/** 動作的預設訓練參數，寫成一行給列表用 */
function defaultsLine(ex: Exercise): string {
  const sets = ex.default_sets ?? 3;
  const target =
    ex.default_mode === "hold"
      ? `${ex.default_hold_seconds ?? 30} 秒`
      : ex.default_mode === "interval"
        ? `${ex.default_interval_seconds ?? 45} 秒`
        : ex.default_reps_min && ex.default_reps_max
          ? `${ex.default_reps_min}–${ex.default_reps_max} 下`
          : "自訂";
  const rest = ex.default_rest_seconds != null ? ` · 休息 ${ex.default_rest_seconds}s` : "";
  return `${sets} 組 × ${target}${rest}`;
}

function ExerciseFields({ ex }: { ex?: Exercise }) {
  const [mode, setMode] = useState<ExerciseMode>(ex?.default_mode ?? "reps");

  return (
    <>
      <div className="field">
        <label>動作名稱（中文）</label>
        <input name="name_zh" defaultValue={ex?.name_zh ?? ""} required />
      </div>
      <div className="field">
        <label>英文名稱（選填）</label>
        <input name="name_en" defaultValue={ex?.name_en ?? ""} />
      </div>

      <div className="two-col">
        <div className="field">
          <label>分類</label>
          <select name="category" defaultValue={ex?.category ?? ""}>
            <option value="">未分類</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>預設器材</label>
          <input
            name="default_equipment"
            placeholder="啞鈴 / 徒手 …"
            defaultValue={ex?.default_equipment ?? ""}
          />
        </div>
      </div>

      <div className="field">
        <label>預設提示語 cue</label>
        <textarea name="default_cue" rows={2} defaultValue={ex?.default_cue ?? ""} />
      </div>

      <div className="subhead">
        預設訓練參數
        <span className="dim-hint"> · 加進訓練卡時直接套用</span>
      </div>

      <div className="two-col">
        <div className="field">
          <label>類型</label>
          <select
            name="default_mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as ExerciseMode)}
          >
            {(Object.keys(MODE_LABELS) as ExerciseMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>組數</label>
          <input
            name="default_sets"
            type="number"
            min={1}
            defaultValue={ex?.default_sets ?? 3}
          />
        </div>
      </div>

      {mode === "reps" ? (
        <div className="two-col">
          <div className="field">
            <label>次數下限</label>
            <input
              name="default_reps_min"
              type="number"
              min={1}
              defaultValue={ex?.default_reps_min ?? 10}
            />
          </div>
          <div className="field">
            <label>次數上限</label>
            <input
              name="default_reps_max"
              type="number"
              min={1}
              defaultValue={ex?.default_reps_max ?? 15}
            />
          </div>
        </div>
      ) : mode === "hold" ? (
        <div className="field">
          <label>持續秒數</label>
          <input
            name="default_hold_seconds"
            type="number"
            min={1}
            defaultValue={ex?.default_hold_seconds ?? 30}
          />
        </div>
      ) : (
        <div className="field">
          <label>
            每組秒數
            <span className="dim-hint"> · 這段時間內盡量做，次數是結果</span>
          </label>
          <input
            name="default_interval_seconds"
            type="number"
            min={1}
            defaultValue={ex?.default_interval_seconds ?? 45}
          />
        </div>
      )}

      <div className="two-col">
        <div className="field">
          <label>組間休息（秒）</label>
          <input
            name="default_rest_seconds"
            type="number"
            min={0}
            defaultValue={ex?.default_rest_seconds ?? 60}
          />
        </div>
        <div className="field">
          <label>預設節奏</label>
          <input
            name="default_tempo"
            placeholder="下放3秒/上推1秒"
            defaultValue={ex?.default_tempo ?? ""}
          />
        </div>
      </div>

      <div className="field">
        <label>
          示範影片網址
          <span className="dim-hint"> · YouTube 連結，留空會顯示搜尋按鈕</span>
        </label>
        <input
          name="media_url"
          type="url"
          inputMode="url"
          placeholder="https://youtu.be/…"
          defaultValue={ex?.media_url ?? ""}
        />
      </div>

      <div className="field">
        <label>備註</label>
        <textarea name="notes" rows={2} defaultValue={ex?.notes ?? ""} />
      </div>
    </>
  );
}

function EditForm({ ex, onDone }: { ex: Exercise; onDone: () => void }) {
  const [state, action] = useActionState(updateExercise, undefined);

  return (
    <form
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
    >
      {state?.error && <div className="notice error">{state.error}</div>}
      <input type="hidden" name="id" value={ex.id} />
      <ExerciseFields ex={ex} />
      <SaveButton label="儲存修改" />
      <button className="btn ghost" type="button" onClick={onDone}>
        取消
      </button>
    </form>
  );
}

export default function ExerciseManager({ exercises }: { exercises: Exercise[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [state, createAction] = useActionState(createExercise, undefined);

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

  // 沒有指定分類時依分類分組顯示，比一長串平列好找
  const groups = useMemo(() => {
    const known = CATEGORIES.filter((c) => visible.some((e) => e.category === c));
    const out: { key: string; items: Exercise[] }[] = known.map((c) => ({
      key: c,
      items: visible.filter((e) => e.category === c),
    }));
    const uncategorised = visible.filter(
      (e) => !e.category || !CATEGORIES.includes(e.category as never)
    );
    if (uncategorised.length) out.push({ key: "", items: uncategorised });
    return out;
  }, [visible]);

  return (
    <>
      <div className="filter-bar">
        <button
          type="button"
          className={`chip-btn${filter === null ? " on" : ""}`}
          onClick={() => setFilter(null)}
        >
          全部 {exercises.length}
        </button>
        {CATEGORIES.filter((c) => counts[c]).map((c) => (
          <button
            key={c}
            type="button"
            className={`chip-btn${filter === c ? " on" : ""}`}
            onClick={() => setFilter(filter === c ? null : c)}
          >
            {categoryLabel(c)} {counts[c]}
          </button>
        ))}
        {counts[""] ? (
          <button
            type="button"
            className={`chip-btn${filter === "" ? " on" : ""}`}
            onClick={() => setFilter(filter === "" ? null : "")}
          >
            未分類 {counts[""]}
          </button>
        ) : null}
      </div>

      <div className="field search-field">
        <input
          type="search"
          placeholder="搜尋動作名稱或器材…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {adding ? (
        <article className="card">
          <form
            action={async (fd) => {
              await createAction(fd);
              setAdding(false);
            }}
          >
            {state?.error && <div className="notice error">{state.error}</div>}
            <ExerciseFields />
            <SaveButton label="新增動作" />
            <button
              className="btn ghost"
              type="button"
              onClick={() => setAdding(false)}
            >
              取消
            </button>
          </form>
        </article>
      ) : (
        <button
          className="btn"
          type="button"
          onClick={() => setAdding(true)}
          style={{ marginBottom: 16 }}
        >
          ＋ 新增動作
        </button>
      )}

      {visible.length === 0 && (
        <div className="empty">
          {exercises.length === 0
            ? "動作庫還是空的。"
            : "沒有符合條件的動作。"}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key || "none"} className="ex-group">
          <h2 className="group-head">
            {categoryLabel(g.key || null)}
            <span className="group-count">{g.items.length}</span>
          </h2>

          {g.items.map((ex) =>
            editingId === ex.id ? (
              <article className="card" key={ex.id}>
                <EditForm ex={ex} onDone={() => setEditingId(null)} />
              </article>
            ) : (
              <article className="card ex-row" key={ex.id}>
                <div className="ex-main">
                  <div className="ex-title">{ex.name_zh}</div>
                  <div className="ex-defaults">{defaultsLine(ex)}</div>
                  <div>
                    {ex.default_equipment && (
                      <span className="chip">{ex.default_equipment}</span>
                    )}
                    {ex.default_mode !== "reps" && (
                      <span className="chip mode">
                        {MODE_LABELS[ex.default_mode]}
                      </span>
                    )}
                    {ex.default_tempo && (
                      <span className="chip tempo">{ex.default_tempo}</span>
                    )}
                  </div>
                  {ex.default_cue && <p className="thesis">{ex.default_cue}</p>}

                  <MediaPreview
                    mediaUrl={ex.media_url}
                    nameZh={ex.name_zh}
                    nameEn={ex.name_en}
                    expandedByDefault={Boolean(ex.media_url)}
                  />
                </div>

                <div className="ex-actions">
                  <button
                    className="btn ghost small"
                    type="button"
                    onClick={() => setEditingId(ex.id)}
                  >
                    編輯
                  </button>
                  <form action={deleteExercise}>
                    <input type="hidden" name="id" value={ex.id} />
                    <button className="btn ghost small" type="submit">
                      刪除
                    </button>
                  </form>
                </div>
              </article>
            )
          )}
        </section>
      ))}
    </>
  );
}

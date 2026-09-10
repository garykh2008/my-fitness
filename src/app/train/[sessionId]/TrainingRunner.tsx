"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  saveSet,
  deleteSet,
  saveFeelNote,
  finishSession,
  abandonSession,
} from "../actions";
import { formatTarget } from "@/lib/types";
import type {
  WorkoutSession,
  WorkoutCardDetail,
  CardExerciseWithExercise,
  ExerciseLogWithSets,
  SetLog,
} from "@/lib/types";
import type { PreviousPerformance } from "@/lib/queries";
import RestTimer from "./RestTimer";
import HoldTimer from "./HoldTimer";
import { useWakeLock } from "./useWakeLock";

type LogMap = Record<string, ExerciseLogWithSets>;
type PrevMap = Record<string, PreviousPerformance>;

function targetSetsOf(ce: CardExerciseWithExercise): number {
  return ce.target_sets ?? 3;
}

/**
 * 這一組的輸入框要帶什麼值進去。優先序：
 *   1. 這次已經記過這一組 → 就是它（等於點進去修改）
 *   2. 這次的前一組 → 通常同重量繼續做
 *   3. 上次同一組
 *   4. 上次的第一組
 * 找不到就留空。
 */
function prefillFor(
  setIndex: number,
  doneSets: SetLog[],
  prev: PreviousPerformance | undefined
): { source: SetLog; isRecord: boolean } | null {
  const existing = doneSets.find((s) => s.set_index === setIndex);
  if (existing) return { source: existing, isRecord: true };

  const earlier = doneSets
    .filter((s) => s.set_index < setIndex)
    .sort((a, b) => b.set_index - a.set_index)[0];
  if (earlier) return { source: earlier, isRecord: false };

  const lastSame = prev?.sets.find((s) => s.set_index === setIndex);
  if (lastSame) return { source: lastSame, isRecord: false };

  if (prev?.sets[0]) return { source: prev.sets[0], isRecord: false };
  return null;
}

/** 把上次的表現寫成一行，例如 "上次 9/8：20kg × 10、20kg × 9" */
function describePrevious(
  prev: PreviousPerformance,
  mode: "reps" | "hold"
): string {
  const d = new Date(prev.performed_at);
  const when = `${d.getMonth() + 1}/${d.getDate()}`;
  const parts = prev.sets.slice(0, 4).map((s) =>
    mode === "hold"
      ? `${s.hold_seconds_done ?? "—"}s`
      : `${s.weight_kg ?? "—"}kg × ${s.reps_done ?? "—"}`
  );
  const more = prev.sets.length > 4 ? ` …等 ${prev.sets.length} 組` : "";
  return `上次 ${when}：${parts.join("、")}${more}`;
}

// --- 單組的輸入區 -----------------------------------------------

function SetEditor({
  ce,
  setIndex,
  prefill,
  saving,
  onSave,
  onCancel,
}: {
  ce: CardExerciseWithExercise;
  setIndex: number;
  prefill: { source: SetLog; isRecord: boolean } | null;
  saving: boolean;
  onSave: (values: {
    weight_kg?: string;
    reps_done?: string;
    hold_seconds_done?: string;
  }) => void;
  onCancel: () => void;
}) {
  const src = prefill?.source;
  const [weight, setWeight] = useState(
    src?.weight_kg != null ? String(src.weight_kg) : ""
  );
  const [reps, setReps] = useState(
    src?.reps_done != null ? String(src.reps_done) : ""
  );
  const [hold, setHold] = useState(
    src?.hold_seconds_done != null
      ? String(src.hold_seconds_done)
      : ce.target_hold_seconds != null
        ? String(ce.target_hold_seconds)
        : ""
  );

  const hint =
    prefill && !prefill.isRecord ? "已帶入參考值，改成實際做的即可" : null;

  if (ce.mode === "hold") {
    return (
      <div className="set-editor">
        <div className="set-no">第 {setIndex} 組</div>

        <HoldTimer
          targetSeconds={ce.target_hold_seconds ?? 30}
          busy={saving}
          onComplete={(secondsDone) =>
            onSave({ hold_seconds_done: String(secondsDone) })
          }
        />

        <div className="manual-row">
          <div className="field">
            <label>或直接輸入秒數</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={hold}
              onChange={(e) => setHold(e.target.value)}
            />
          </div>
          <button
            className="btn small"
            type="button"
            disabled={saving}
            onClick={() => onSave({ hold_seconds_done: hold })}
          >
            {saving ? "儲存中…" : "記錄"}
          </button>
        </div>

        <button className="btn ghost small" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    );
  }

  return (
    <div className="set-editor">
      <div className="set-no">第 {setIndex} 組</div>
      {hint && <div className="prefill-hint">{hint}</div>}

      <div className="two-col">
        <div className="field">
          <label>重量 (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onFocus={(e) => e.target.select()}
            autoFocus
          />
        </div>
        <div className="field">
          <label>次數</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>

      <div className="editor-actions">
        <button
          className="btn primary"
          type="button"
          disabled={saving}
          onClick={() => onSave({ weight_kg: weight, reps_done: reps })}
        >
          {saving ? "儲存中…" : "完成這組"}
        </button>
        <button className="btn ghost" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}

// --- 感受筆記 ---------------------------------------------------

function FeelNote({
  sessionId,
  cardExerciseId,
  initial,
}: {
  sessionId: string;
  cardExerciseId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState<string>(initial);
  const [, startTransition] = useTransition();

  const flush = () => {
    if (value === saved) return;
    const fd = new FormData();
    fd.set("session_id", sessionId);
    fd.set("card_exercise_id", cardExerciseId);
    fd.set("feel_note", value);
    const snapshot = value;
    startTransition(async () => {
      await saveFeelNote(undefined, fd);
      setSaved(snapshot);
    });
  };

  return (
    <div className="field feel-note">
      <label>
        感受筆記
        {value !== saved ? (
          <span className="dim-hint"> · 離開輸入框自動儲存</span>
        ) : value ? (
          <span className="saved-hint"> · 已儲存</span>
        ) : null}
      </label>
      <textarea
        rows={2}
        placeholder="例：下放到底上臂感受變多"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={flush}
      />
    </div>
  );
}

// --- 主元件 -----------------------------------------------------

export default function TrainingRunner({
  session,
  card,
  logs,
  previous,
}: {
  session: WorkoutSession;
  card: WorkoutCardDetail;
  logs: LogMap;
  previous: PrevMap;
}) {
  useWakeLock(true);

  const exercises = card.card_exercises;

  const doneCountOf = useCallback(
    (ce: CardExerciseWithExercise) => logs[ce.id]?.set_logs.length ?? 0,
    [logs]
  );

  const firstIncomplete = useMemo(() => {
    const i = exercises.findIndex((ce) => doneCountOf(ce) < targetSetsOf(ce));
    return i === -1 ? 0 : i;
  }, [exercises, doneCountOf]);

  const [openIndex, setOpenIndex] = useState(firstIncomplete);
  const [openSet, setOpenSet] = useState<{ ceId: string; n: number } | null>(
    null
  );
  const [resting, setResting] = useState<{ seconds: number } | null>(null);
  const [pendingAdvance, setPendingAdvance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [finishing, setFinishing] = useState(false);

  const totalSets = exercises.reduce((n, ce) => n + targetSetsOf(ce), 0);
  const doneSets = Object.values(logs).reduce(
    (n, log) => n + log.set_logs.length,
    0
  );
  const doneExercises = exercises.filter(
    (ce) => doneCountOf(ce) >= targetSetsOf(ce)
  ).length;

  const nextIncompleteAfter = (index: number) => {
    for (let i = index + 1; i < exercises.length; i++) {
      if (doneCountOf(exercises[i]) < targetSetsOf(exercises[i])) return i;
    }
    return null;
  };

  const handleSave = (
    ce: CardExerciseWithExercise,
    index: number,
    setIndex: number,
    values: Record<string, string | undefined>
  ) => {
    const fd = new FormData();
    fd.set("session_id", session.id);
    fd.set("card_exercise_id", ce.id);
    fd.set("set_index", String(setIndex));
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined) fd.set(k, v);
    }

    // 這一組存完之後，這個動作就練完了嗎？props 要等 revalidate 才更新，先自己算
    const alreadyRecorded = (logs[ce.id]?.set_logs ?? []).some(
      (s) => s.set_index === setIndex
    );
    const willBeDone =
      doneCountOf(ce) + (alreadyRecorded ? 0 : 1) >= targetSetsOf(ce);

    startSaving(async () => {
      const res = await saveSet(undefined, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setOpenSet(null);
      setPendingAdvance(willBeDone ? index : null);

      if (ce.rest_seconds && ce.rest_seconds > 0) {
        setResting({ seconds: ce.rest_seconds });
      } else if (willBeDone) {
        const next = nextIncompleteAfter(index);
        if (next !== null) setOpenIndex(next);
        setPendingAdvance(null);
      }
    });
  };

  const endRest = () => {
    setResting(null);
    if (pendingAdvance !== null) {
      const next = nextIncompleteAfter(pendingAdvance);
      if (next !== null) setOpenIndex(next);
      setPendingAdvance(null);
    }
  };

  return (
    <main className="shell train">
      <header className="progress-bar-wrap">
        <div className="progress-line">
          <div className="progress-title">{card.title}</div>
          <div className="progress-stat">
            {doneExercises}/{exercises.length} 動作 · {doneSets}/{totalSets} 組
          </div>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }}
          />
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}

      {card.thesis && <div className="notice info">{card.thesis}</div>}

      {exercises.map((ce, i) => {
        const log = logs[ce.id];
        const done = log?.set_logs ?? [];
        const target = targetSetsOf(ce);
        const complete = done.length >= target;
        const isOpen = i === openIndex;
        const prev = previous[ce.exercise_id];

        if (!isOpen) {
          return (
            <button
              key={ce.id}
              type="button"
              className={`ex-collapsed${complete ? " complete" : ""}`}
              onClick={() => {
                setOpenIndex(i);
                setOpenSet(null);
              }}
            >
              <span className="ex-idx">{i + 1}</span>
              <span className="ex-name">{ce.exercise.name_zh}</span>
              <span className="ex-count">
                {done.length}/{target}
              </span>
              <span className="ex-mark">{complete ? "✓" : ""}</span>
            </button>
          );
        }

        // 目標組數之外還可以多加一組（練超過目標是常有的事）
        const slots = Math.max(target, done.length + 1);
        const setIndexes = Array.from({ length: slots }, (_, k) => k + 1);
        const cue = ce.cue_text || ce.exercise.default_cue;

        return (
          <article className="card ex-open" key={ce.id}>
            <h2>
              {i + 1}. {ce.exercise.name_zh}
            </h2>

            <div>
              <span className="chip mode">
                {target} 組 × {formatTarget(ce)}
              </span>
              {ce.tempo_text && (
                <span className="chip tempo">{ce.tempo_text}</span>
              )}
              {ce.rest_seconds != null && (
                <span className="chip">休息 {ce.rest_seconds}s</span>
              )}
            </div>

            {cue && <p className="thesis cue">{cue}</p>}

            {prev && (
              <div className="prev-line">
                <div>{describePrevious(prev, ce.mode)}</div>
                {prev.feel_note && (
                  <div className="prev-feel">「{prev.feel_note}」</div>
                )}
              </div>
            )}

            <div className="sets">
              {setIndexes.map((n) => {
                const existing = done.find((s) => s.set_index === n);
                const editing = openSet?.ceId === ce.id && openSet.n === n;

                if (editing) {
                  return (
                    <div className="set-row open" key={n}>
                      <SetEditor
                        ce={ce}
                        setIndex={n}
                        prefill={prefillFor(n, done, prev)}
                        saving={saving}
                        onSave={(values) => handleSave(ce, i, n, values)}
                        onCancel={() => setOpenSet(null)}
                      />
                    </div>
                  );
                }

                return (
                  <div className={`set-row${existing ? " done" : ""}`} key={n}>
                    <button
                      className="set-tap"
                      type="button"
                      onClick={() => setOpenSet({ ceId: ce.id, n })}
                    >
                      <span className="set-no">第 {n} 組</span>
                      <span className="set-val">
                        {existing ? (
                          ce.mode === "reps" ? (
                            <>
                              {existing.weight_kg ?? "—"} kg ×{" "}
                              {existing.reps_done ?? "—"}
                            </>
                          ) : (
                            <>{existing.hold_seconds_done ?? "—"} 秒</>
                          )
                        ) : (
                          <span className="set-empty">
                            {ce.mode === "hold" ? "點一下開始計時" : "點一下記錄"}
                          </span>
                        )}
                      </span>
                      <span className="set-mark">{existing ? "✓" : "＋"}</span>
                    </button>

                    {existing && (
                      <form action={deleteSet} className="set-del">
                        <input
                          type="hidden"
                          name="session_id"
                          value={session.id}
                        />
                        <input
                          type="hidden"
                          name="set_log_id"
                          value={existing.id}
                        />
                        <button type="submit" title="刪除這組">
                          ×
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>

            <FeelNote
              sessionId={session.id}
              cardExerciseId={ce.id}
              initial={log?.feel_note ?? ""}
            />

            {complete && nextIncompleteAfter(i) !== null && (
              <button
                className="btn ghost"
                type="button"
                onClick={() => setOpenIndex(nextIncompleteAfter(i)!)}
              >
                下一個動作 →
              </button>
            )}
          </article>
        );
      })}

      {finishing ? (
        <article className="card">
          <form action={finishSession}>
            <input type="hidden" name="session_id" value={session.id} />
            <div className="field">
              <label>整場感受 / 備註</label>
              <textarea
                name="overall_note"
                rows={3}
                placeholder="今天整體狀況如何？"
                defaultValue={session.overall_note ?? ""}
                autoFocus
              />
            </div>
            <button className="btn primary" type="submit">
              結束訓練
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setFinishing(false)}
            >
              再練一下
            </button>
          </form>
        </article>
      ) : (
        <button
          className="btn primary"
          type="button"
          onClick={() => setFinishing(true)}
        >
          結束訓練
        </button>
      )}

      <form action={abandonSession} style={{ marginTop: 24 }}>
        <input type="hidden" name="session_id" value={session.id} />
        <input type="hidden" name="workout_card_id" value={card.id} />
        <button className="btn ghost" type="submit">
          放棄這次訓練（刪除紀錄）
        </button>
      </form>

      {resting && (
        <RestTimer seconds={resting.seconds} onDone={endRest} />
      )}
    </main>
  );
}

"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
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

type LogMap = Record<string, ExerciseLogWithSets>;

function SubmitButton({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

/** 一組的輸入框。已存過的組會帶入原本的值，等於「點進去改」。 */
function SetForm({
  sessionId,
  ce,
  setIndex,
  existing,
  onDone,
}: {
  sessionId: string;
  ce: CardExerciseWithExercise;
  setIndex: number;
  existing?: SetLog;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveSet, undefined);

  return (
    <form
      className="set-form"
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
    >
      {state?.error && <div className="notice error">{state.error}</div>}

      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="card_exercise_id" value={ce.id} />
      <input type="hidden" name="set_index" value={setIndex} />

      {ce.mode === "reps" ? (
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 1, marginBottom: 10 }}>
            <label>重量 (kg)</label>
            <input
              name="weight_kg"
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0}
              defaultValue={existing?.weight_kg ?? ""}
              autoFocus
            />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 10 }}>
            <label>次數</label>
            <input
              name="reps_done"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={existing?.reps_done ?? ""}
            />
          </div>
        </div>
      ) : (
        <div className="field" style={{ marginBottom: 10 }}>
          <label>持續秒數</label>
          <input
            name="hold_seconds_done"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={
              existing?.hold_seconds_done ?? ce.target_hold_seconds ?? ""
            }
            autoFocus
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton label="完成這組" busy="儲存中…" />
        <button className="btn ghost" type="button" onClick={onDone}>
          取消
        </button>
      </div>
    </form>
  );
}

/** 感受筆記：離開輸入框（blur）時才送出，練習中不用一直按儲存 */
function FeelNote({
  sessionId,
  ce,
  initial,
}: {
  sessionId: string;
  ce: CardExerciseWithExercise;
  initial: string;
}) {
  const [state, action] = useActionState(saveFeelNote, undefined);
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);

  return (
    <form action={action}>
      {state?.error && <div className="notice error">{state.error}</div>}
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="card_exercise_id" value={ce.id} />
      <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
        <label>
          感受筆記{saved && <span className="saved-hint"> · 已儲存</span>}
        </label>
        <textarea
          name="feel_note"
          rows={2}
          placeholder="例：下放到底上臂感受變多"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          onBlur={(e) => {
            if (e.target.value !== initial) {
              e.currentTarget.form?.requestSubmit();
              setSaved(true);
            }
          }}
        />
      </div>
    </form>
  );
}

function ExerciseBlock({
  sessionId,
  ce,
  index,
  log,
}: {
  sessionId: string;
  ce: CardExerciseWithExercise;
  index: number;
  log?: ExerciseLogWithSets;
}) {
  const [openSet, setOpenSet] = useState<number | null>(null);

  const targetSets = ce.target_sets ?? 3;
  const done = log?.set_logs ?? [];
  // 目標組數之外還可以多加一組（練超過目標是常有的事）
  const slots = Math.max(targetSets, done.length + (done.length >= targetSets ? 1 : 0));
  const setIndexes = Array.from({ length: slots }, (_, i) => i + 1);

  const cue = ce.cue_text || ce.exercise.default_cue;

  return (
    <article className="card">
      <h2>
        {index + 1}. {ce.exercise.name_zh}
      </h2>

      <div>
        <span className="chip mode">
          {targetSets} 組 × {formatTarget(ce)}
        </span>
        {ce.tempo_text && <span className="chip tempo">{ce.tempo_text}</span>}
        {ce.rest_seconds != null && (
          <span className="chip">休息 {ce.rest_seconds}s</span>
        )}
      </div>

      {cue && (
        <p className="thesis" style={{ marginTop: 10 }}>
          {cue}
        </p>
      )}

      <div className="sets">
        {setIndexes.map((n) => {
          const existing = done.find((s) => s.set_index === n);
          const isOpen = openSet === n;

          if (isOpen) {
            return (
              <div className="set-row open" key={n}>
                <div className="set-no">第 {n} 組</div>
                <SetForm
                  sessionId={sessionId}
                  ce={ce}
                  setIndex={n}
                  existing={existing}
                  onDone={() => setOpenSet(null)}
                />
              </div>
            );
          }

          return (
            <div className={`set-row${existing ? " done" : ""}`} key={n}>
              <button
                className="set-tap"
                type="button"
                onClick={() => setOpenSet(n)}
              >
                <span className="set-no">第 {n} 組</span>
                <span className="set-val">
                  {existing ? (
                    ce.mode === "reps" ? (
                      <>
                        {existing.weight_kg ?? "—"} kg × {existing.reps_done ?? "—"}
                      </>
                    ) : (
                      <>{existing.hold_seconds_done ?? "—"} 秒</>
                    )
                  ) : (
                    <span className="set-empty">點一下記錄</span>
                  )}
                </span>
                <span className="set-mark">{existing ? "✓" : "＋"}</span>
              </button>

              {existing && (
                <form action={deleteSet} className="set-del">
                  <input type="hidden" name="session_id" value={sessionId} />
                  <input type="hidden" name="set_log_id" value={existing.id} />
                  <button type="submit" title="刪除這組">
                    ×
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <FeelNote sessionId={sessionId} ce={ce} initial={log?.feel_note ?? ""} />
    </article>
  );
}

export default function TrainingRunner({
  session,
  card,
  logs,
}: {
  session: WorkoutSession;
  card: WorkoutCardDetail;
  logs: LogMap;
}) {
  const [finishing, setFinishing] = useState(false);

  const totalSets = card.card_exercises.reduce(
    (sum, ce) => sum + (ce.target_sets ?? 3),
    0
  );
  const doneSets = Object.values(logs).reduce(
    (sum, log) => sum + log.set_logs.length,
    0
  );

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>{card.title}</h1>
          <div className="sub">
            {new Date(session.performed_at).toLocaleDateString("zh-TW")} ·
            已完成 {doneSets} / {totalSets} 組
          </div>
        </div>
      </div>

      {card.thesis && <div className="notice info">{card.thesis}</div>}

      {card.card_exercises.map((ce, i) => (
        <ExerciseBlock
          key={ce.id}
          sessionId={session.id}
          ce={ce}
          index={i}
          log={logs[ce.id]}
        />
      ))}

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
            <SubmitButton label="結束訓練" busy="儲存中…" />
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
    </main>
  );
}

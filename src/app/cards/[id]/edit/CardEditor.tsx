"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  updateCard,
  updateCardExercise,
  removeCardExercise,
  moveCardExercise,
} from "../../actions";
import ExercisePicker from "./ExercisePicker";
import DangerZone from "./DangerZone";
import { formatTarget, MODE_LABELS } from "@/lib/types";
import type { ExerciseMode } from "@/lib/types";
import type {
  Exercise,
  WorkoutCardDetail,
  CardExerciseWithExercise,
} from "@/lib/types";
import type { CardStats } from "@/lib/queries";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? "儲存中…" : label}
    </button>
  );
}

/** 目標設定欄位：mode 切換時只顯示對得上的欄位（DB 有 check constraint） */
function TargetFields({ ce }: { ce?: CardExerciseWithExercise }) {
  const [mode, setMode] = useState<ExerciseMode>(ce?.mode ?? "reps");

  return (
    <>
      <div className="field">
        <label>類型</label>
        <select
          name="mode"
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
        <label>目標組數</label>
        <input
          name="target_sets"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={ce?.target_sets ?? 3}
        />
      </div>

      {mode === "reps" ? (
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>次數下限</label>
            <input
              name="target_reps_min"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={ce?.target_reps_min ?? ""}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>次數上限</label>
            <input
              name="target_reps_max"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={ce?.target_reps_max ?? ""}
            />
          </div>
        </div>
      ) : mode === "hold" ? (
        <div className="field">
          <label>持續秒數</label>
          <input
            name="target_hold_seconds"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={ce?.target_hold_seconds ?? ""}
          />
        </div>
      ) : (
        <div className="field">
          <label>
            每組秒數
            <span className="dim-hint"> · 這段時間內盡量做</span>
          </label>
          <input
            name="target_interval_seconds"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={ce?.target_interval_seconds ?? 45}
          />
        </div>
      )}

      <div className="field">
        <label>節奏 tempo</label>
        <input
          name="tempo_text"
          placeholder="例：下放3秒/頂端擠壓1秒/上推1秒"
          defaultValue={ce?.tempo_text ?? ""}
        />
      </div>

      <div className="field">
        <label>提示語 cue（覆寫動作庫預設）</label>
        <textarea name="cue_text" rows={2} defaultValue={ce?.cue_text ?? ""} />
      </div>

      <div className="field">
        <label>組間休息（秒）</label>
        <input
          name="rest_seconds"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={ce?.rest_seconds ?? 90}
        />
      </div>
    </>
  );
}

function EditExerciseForm({
  ce,
  cardId,
  onDone,
}: {
  ce: CardExerciseWithExercise;
  cardId: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState(updateCardExercise, undefined);

  return (
    <form
      action={async (fd) => {
        await action(fd);
        onDone();
      }}
    >
      {state?.error && <div className="notice error">{state.error}</div>}
      <input type="hidden" name="id" value={ce.id} />
      <input type="hidden" name="workout_card_id" value={cardId} />
      <TargetFields ce={ce} />
      <SaveButton label="儲存" />
      <button className="btn ghost" type="button" onClick={onDone}>
        取消
      </button>
    </form>
  );
}

export default function CardEditor({
  card,
  exercises,
  stats,
}: {
  card: WorkoutCardDetail;
  exercises: Exercise[];
  stats: CardStats;
}) {
  const [metaState, metaAction] = useActionState(updateCard, undefined);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const total = card.card_exercises.length;

  return (
    <>
      {/* --- 卡片基本資料 --- */}
      <article className="card">
        <form action={metaAction}>
          {metaState?.error && (
            <div className="notice error">{metaState.error}</div>
          )}
          <input type="hidden" name="id" value={card.id} />
          <div className="field">
            <label>標題</label>
            <input name="title" defaultValue={card.title} required />
          </div>
          <div className="field">
            <label>訓練邏輯</label>
            <textarea name="thesis" rows={2} defaultValue={card.thesis ?? ""} />
          </div>
          <div className="field">
            <label>來源備註</label>
            <textarea
              name="source_note"
              rows={2}
              defaultValue={card.source_note ?? ""}
            />
          </div>
          <SaveButton label="儲存卡片資訊" />
        </form>
      </article>

      {/* --- 動作清單 --- */}
      {card.card_exercises.map((ce, i) => (
        <article className="card" key={ce.id}>
          {editingId === ce.id ? (
            <EditExerciseForm
              ce={ce}
              cardId={card.id}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <>
              <h2>
                <span className="ex-idx">
                  {String(i + 1).padStart(2, "0")}
                </span>{" "}
                {ce.exercise.name_zh}
              </h2>
              <div>
                <span className="chip mode">
                  {ce.target_sets ? `${ce.target_sets} 組 × ` : ""}
                  {formatTarget(ce)}
                </span>
                {ce.tempo_text && (
                  <span className="chip tempo">{ce.tempo_text}</span>
                )}
                {ce.rest_seconds != null && (
                  <span className="chip">休息 {ce.rest_seconds}s</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <form action={moveCardExercise}>
                  <input type="hidden" name="id" value={ce.id} />
                  <input type="hidden" name="workout_card_id" value={card.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button className="btn ghost small" type="submit" disabled={i === 0}>
                    ↑
                  </button>
                </form>
                <form action={moveCardExercise}>
                  <input type="hidden" name="id" value={ce.id} />
                  <input type="hidden" name="workout_card_id" value={card.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    className="btn ghost small"
                    type="submit"
                    disabled={i === total - 1}
                  >
                    ↓
                  </button>
                </form>
                <button
                  className="btn ghost small"
                  type="button"
                  onClick={() => setEditingId(ce.id)}
                >
                  編輯
                </button>
                <form action={removeCardExercise}>
                  <input type="hidden" name="id" value={ce.id} />
                  <input type="hidden" name="workout_card_id" value={card.id} />
                  <button className="btn ghost small" type="submit">
                    移除
                  </button>
                </form>
              </div>
            </>
          )}
        </article>
      ))}

      {/* --- 加入動作：挑一個就好，細項套用動作庫的預設值 --- */}
      {adding ? (
        <ExercisePicker
          cardId={card.id}
          exercises={exercises}
          usedExerciseIds={card.card_exercises.map((ce) => ce.exercise_id)}
          onClose={() => setAdding(false)}
        />
      ) : (
        <button
          className="btn"
          type="button"
          onClick={() => setAdding(true)}
          disabled={exercises.length === 0}
        >
          ＋ 加入動作
        </button>
      )}

      <Link href="/exercises">
        <button className="btn ghost" type="button" style={{ marginTop: 8 }}>
          管理動作庫
        </button>
      </Link>

      <DangerZone cardId={card.id} stats={stats} />
    </>
  );
}

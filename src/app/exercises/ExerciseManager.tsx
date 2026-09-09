"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createExercise, updateExercise, deleteExercise } from "./actions";
import type { Exercise } from "@/lib/types";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? "儲存中…" : label}
    </button>
  );
}

function ExerciseFields({ ex }: { ex?: Exercise }) {
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
      <div className="field">
        <label>分類（例：chest / back / legs / core）</label>
        <input name="category" defaultValue={ex?.category ?? ""} />
      </div>
      <div className="field">
        <label>預設器材（例：啞鈴 / 瑜珈墊 / 徒手）</label>
        <input name="default_equipment" defaultValue={ex?.default_equipment ?? ""} />
      </div>
      <div className="field">
        <label>預設提示語 cue</label>
        <textarea name="default_cue" rows={2} defaultValue={ex?.default_cue ?? ""} />
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
  const [state, createAction] = useActionState(createExercise, undefined);

  return (
    <>
      {exercises.length === 0 && !adding && (
        <div className="empty">
          動作庫還是空的。
          <br />
          先把常做的動作建進來，訓練卡才有東西可以選。
        </div>
      )}

      {exercises.map((ex) => (
        <article className="card" key={ex.id}>
          {editingId === ex.id ? (
            <EditForm ex={ex} onDone={() => setEditingId(null)} />
          ) : (
            <>
              <h2>{ex.name_zh}</h2>
              {ex.name_en && <p className="thesis">{ex.name_en}</p>}
              <div>
                {ex.category && <span className="chip">{ex.category}</span>}
                {ex.default_equipment && (
                  <span className="chip">{ex.default_equipment}</span>
                )}
              </div>
              {ex.default_cue && <p className="thesis">cue：{ex.default_cue}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
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
            </>
          )}
        </article>
      ))}

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
        <button className="btn" type="button" onClick={() => setAdding(true)}>
          ＋ 新增動作
        </button>
      )}
    </>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  saveSet,
  deleteSet,
  saveFeelNote,
  finishSession,
  abandonSession,
} from "../actions";
import { formatTarget } from "@/lib/types";
import type {
  ExerciseMode,
  WorkoutSession,
  WorkoutCardDetail,
  CardExerciseWithExercise,
  ExerciseLogWithSets,
  SetLog,
} from "@/lib/types";
import type { PreviousPerformance } from "@/lib/queries";
import type { SoundSettings } from "./useSoundSettings";
import RestTimer from "./RestTimer";
import HoldTimer from "./HoldTimer";
import IntervalTimer from "./IntervalTimer";
import { useWakeLock } from "./useWakeLock";
import { unlockAudio } from "./timer-utils";
import { useSoundSettings } from "./useSoundSettings";
import { SoundButton, SoundPanel } from "./SoundControls";
import MediaPreview from "../../MediaPreview";
import Wheel, { range } from "./Wheel";

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
  mode: ExerciseMode
): string {
  const d = new Date(prev.performed_at);
  const when = `${d.getMonth() + 1}/${d.getDate()}`;
  const parts = prev.sets.slice(0, 4).map((s) => {
    if (mode === "hold") return `${s.hold_seconds_done ?? "—"}s`;
    if (mode === "interval") return `${s.weight_kg ?? "—"}kg`;
    return `${s.weight_kg ?? "—"}kg × ${s.reps_done ?? "—"}`;
  });
  const more = prev.sets.length > 4 ? ` …等 ${prev.sets.length} 組` : "";
  return `上次 ${when}：${parts.join("、")}${more}`;
}

// --- 單組的輸入區 -----------------------------------------------

// 滾輪的可選範圍。以在家啞鈴訓練為準：重量 0–120kg，0.5 為一階。
// 秒數用 1 為一階而不是 5，因為 hold 計時器提早停下時會記下精確秒數
// （例如撐了 37 秒），回頭編輯時滾輪要找得到那個值。
const WEIGHT_VALUES = range(0, 120, 0.5);
const REPS_VALUES = range(0, 60, 1);
const HOLD_VALUES = range(0, 300, 1);

function SetEditor({
  ce,
  setIndex,
  prefill,
  saving,
  sound,
  onSave,
  onCancel,
}: {
  ce: CardExerciseWithExercise;
  setIndex: number;
  prefill: { source: SetLog; isRecord: boolean } | null;
  saving: boolean;
  sound: SoundSettings;
  onSave: (values: {
    weight_kg?: string;
    reps_done?: string;
    hold_seconds_done?: string;
  }) => void;
  onCancel: () => void;
}) {
  const src = prefill?.source;

  const [weight, setWeight] = useState<number>(src?.weight_kg ?? 0);
  const [reps, setReps] = useState<number>(
    src?.reps_done ?? ce.target_reps_min ?? 10
  );
  const [hold, setHold] = useState<number>(
    src?.hold_seconds_done ?? ce.target_hold_seconds ?? 30
  );
  // interval 提前結束時的實際秒數；做滿就是 null（不用特別記）
  const [elapsed, setElapsed] = useState<number | null>(
    src?.hold_seconds_done ?? null
  );

  const hint =
    prefill && !prefill.isRecord ? "已帶入參考值，滾一下改成實際做的" : null;

  // 時間制：計時器只負責報時，成績要自己填 —— 這段時間內做了幾下才是重點
  if (ce.mode === "interval") {
    const target = ce.target_interval_seconds ?? 45;
    return (
      <div className="set-editor">
        <div className="set-no">第 {setIndex} 組</div>

        <IntervalTimer
          targetSeconds={target}
          sound={sound}
          onFinish={(secondsDone) =>
            setElapsed(secondsDone < target ? secondsDone : null)
          }
        />

        {elapsed !== null && (
          <div className="prefill-hint">
            提前在 {elapsed} 秒結束，會一起記下來
          </div>
        )}

        {/* 時間制不記次數：做 50 秒的時候沒有人在數下數，記重量就夠了 */}
        <div className="manual-caption" style={{ marginTop: 14 }}>
          這 {target} 秒用的重量
        </div>
        <div className="wheels">
          <Wheel
            label="重量"
            unit="kg"
            values={WEIGHT_VALUES}
            value={weight}
            onChange={setWeight}
          />
        </div>

        <div className="editor-actions">
          <button
            className="btn primary"
            type="button"
            disabled={saving}
            onClick={() =>
              onSave({
                weight_kg: String(weight),
                ...(elapsed !== null
                  ? { hold_seconds_done: String(elapsed) }
                  : {}),
              })
            }
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

  if (ce.mode === "hold") {
    return (
      <div className="set-editor">
        <div className="set-no">第 {setIndex} 組</div>

        <HoldTimer
          targetSeconds={ce.target_hold_seconds ?? 30}
          busy={saving}
          sound={sound}
          onComplete={(secondsDone) =>
            onSave({ hold_seconds_done: String(secondsDone) })
          }
        />

        <div className="manual-block">
          <div className="manual-caption">或直接選秒數</div>
          <div className="wheels">
            <Wheel
              label="秒數"
              values={HOLD_VALUES}
              value={hold}
              onChange={setHold}
            />
          </div>
          <button
            className="btn"
            type="button"
            disabled={saving}
            onClick={() => onSave({ hold_seconds_done: String(hold) })}
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

      <div className="wheels">
        <Wheel
          label="重量"
          unit="kg"
          values={WEIGHT_VALUES}
          value={weight}
          onChange={setWeight}
        />
        <Wheel
          label="次數"
          values={REPS_VALUES}
          value={reps}
          onChange={setReps}
        />
      </div>

      <div className="editor-actions">
        <button
          className="btn primary"
          type="button"
          disabled={saving}
          onClick={() =>
            onSave({ weight_kg: String(weight), reps_done: String(reps) })
          }
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

  // Server Action 的 redirect() 不會重設捲動位置，而「開始訓練」那顆按鈕
  // 在卡片頁的最下方（要捲過整份動作清單才看得到），所以跳轉過來時
  // 會直接停在執行頁的底部。這裡把它拉回最上面。
  //
  // 依賴 session.id 而不是空陣列：換一次訓練就重跑一次；
  // 存一組重量只是 revalidate、元件不會重新掛載，不會亂跳。
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [session.id]);

  const [sound, setSound] = useSoundSettings();
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);

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
  // seq 讓每次休息都是新的一輪：只換 seconds 的話 RestTimer 不會重新掛載，
  // 倒數就會接著上一輪剩下的時間跑。
  const [resting, setResting] = useState<{ seconds: number; seq: number } | null>(
    null
  );
  const restSeqRef = useRef(0);

  /**
   * 打開某一組的輸入區 = 要開始練下一組了，休息到此為止。
   * 不關掉的話，休息倒數會跟動作的計時器同時跑，兩組嗶聲交錯。
   */
  const openSetEditor = (ceId: string, n: number) => {
    setResting(null);
    setOpenSet({ ceId, n });
  };
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
    // 這裡還在使用者的點擊手勢裡，趁機把 AudioContext 解鎖：
    // 等休息倒數跑到 0 才建立的話，iOS 會直接把聲音擋掉。
    unlockAudio();

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
        restSeqRef.current += 1;
        setResting({ seconds: ce.rest_seconds, seq: restSeqRef.current });
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
          <div className="progress-right">
            <div className="progress-stat">
              {doneExercises}/{exercises.length} 動作 · {doneSets}/{totalSets} 組
            </div>
            <SoundButton
              settings={sound}
              open={soundPanelOpen}
              onToggleOpen={() => setSoundPanelOpen((v) => !v)}
            />
          </div>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }}
          />
        </div>

        {/* 面板放在進度條之後，才能吃到整行寬度 */}
        {soundPanelOpen && <SoundPanel settings={sound} onChange={setSound} />}
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
              <span className="ex-idx">{String(i + 1).padStart(2, "0")}</span>
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
              <span className="ex-idx">
                {String(i + 1).padStart(2, "0")}
              </span>{" "}
              {ce.exercise.name_zh}
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

            {cue && <p className="cue">{cue}</p>}

            {/* 收合狀態不發任何外部請求；點開才載縮圖，再點才載播放器 */}
            <MediaPreview
              mediaUrl={ce.exercise.media_url}
              nameZh={ce.exercise.name_zh}
              nameEn={ce.exercise.name_en}
            />

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
                        sound={sound}
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
                      onClick={() => openSetEditor(ce.id, n)}
                    >
                      <span className="set-no">第 {n} 組</span>
                      <span className="set-val">
                        {existing ? (
                          ce.mode === "hold" ? (
                            <>{existing.hold_seconds_done ?? "—"} 秒</>
                          ) : ce.mode === "interval" ? (
                            <>
                              {existing.weight_kg ?? "—"} kg
                              {existing.hold_seconds_done != null && (
                                <span className="set-partial">
                                  {" "}
                                  · {existing.hold_seconds_done} 秒
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              {existing.weight_kg ?? "—"} kg ×{" "}
                              {existing.reps_done ?? "—"}
                            </>
                          )
                        ) : (
                          <span className="set-empty">
                            {ce.mode === "reps" ? "點一下記錄" : "點一下開始計時"}
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
        <RestTimer
          key={resting.seq}
          seconds={resting.seconds}
          onDone={endRest}
          sound={sound}
        />
      )}
    </main>
  );
}

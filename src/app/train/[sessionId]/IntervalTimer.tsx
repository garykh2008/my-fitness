"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatSeconds,
  notifyDone,
  playTick,
  remainingFrom,
  shouldTick,
  unlockAudio,
} from "./timer-utils";
import type { SoundSettings } from "./useSoundSettings";

// 時間制動作的計時器。
//
// 跟 HoldTimer 的差別在「時間到之後要做什麼」：
//   hold     時間到就是這組的成績，直接記錄秒數
//   interval 時間到只是提示你停，成績是這段時間內做了幾下 —— 還要你自己填
//
// 所以這支不會自動存檔，只負責報時，並把「實際做滿沒」告訴上層。

type Phase = "idle" | "running" | "done";

export default function IntervalTimer({
  targetSeconds,
  sound,
  onFinish,
}: {
  targetSeconds: number;
  sound: SoundSettings;
  /** 回報實際做了幾秒。做滿就等於 targetSeconds。 */
  onFinish: (secondsDone: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [endsAt, setEndsAt] = useState(0);
  const [left, setLeft] = useState(targetSeconds);
  const firedRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "running") return;

    const tick = () => {
      const r = remainingFrom(endsAt);
      setLeft(r);

      const t = shouldTick(r, lastTickRef.current, sound.tickFrom);
      if (t !== null) {
        lastTickRef.current = t;
        if (!sound.muted) playTick();
      }

      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        notifyDone(sound.muted);
        setPhase("done");
        onFinish(targetSeconds);
      }
    };

    tick();
    const id = setInterval(tick, 200);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, endsAt, targetSeconds, onFinish, sound.tickFrom, sound.muted]);

  const start = () => {
    // 在點擊手勢裡解鎖音訊，否則 iOS 倒數到 0 不會有聲音
    unlockAudio();
    firedRef.current = false;
    lastTickRef.current = null;
    setEndsAt(Date.now() + targetSeconds * 1000);
    setLeft(targetSeconds);
    setPhase("running");
  };

  const stopEarly = () => {
    const done = Math.round(targetSeconds - remainingFrom(endsAt));
    setPhase("done");
    onFinish(Math.max(0, done));
  };

  if (phase === "running") {
    const pct = Math.min(100, Math.max(0, (1 - left / targetSeconds) * 100));
    return (
      <div className="hold-timer running">
        <div className="hold-bar" style={{ width: `${pct}%` }} />
        <div className="hold-body">
          <div className="hold-count">{formatSeconds(left)}</div>
          <button className="btn ghost small" type="button" onClick={stopEarly}>
            提前結束
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      className={`btn${phase === "done" ? " ghost" : " primary"}`}
      type="button"
      onClick={start}
    >
      {phase === "done" ? "重新計時" : `開始 ${targetSeconds} 秒`}
    </button>
  );
}

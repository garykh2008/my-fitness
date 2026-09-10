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

// 持續秒數型動作（等長收縮）的計時器。
//
// 按開始 → 倒數 → 時間到自動停止並把實際秒數回報出去。
// 中途停掉也會回報「實際撐了幾秒」，因為撐不完才是真的需要被記下來的資訊。

type Phase = "idle" | "running" | "finished";

export default function HoldTimer({
  targetSeconds,
  onComplete,
  busy,
}: {
  targetSeconds: number;
  onComplete: (secondsDone: number) => void;
  busy?: boolean;
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

      // 最後 3 秒報數，撐著的時候看不到螢幕也知道快結束了
      const t = shouldTick(r, lastTickRef.current);
      if (t !== null) {
        lastTickRef.current = t;
        playTick();
      }

      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        notifyDone();
        setPhase("finished");
        onComplete(targetSeconds);
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
  }, [phase, endsAt, targetSeconds, onComplete]);

  const start = () => {
    // 在使用者手勢中解鎖音訊，否則 iOS 倒數到 0 時不會有聲音
    unlockAudio();
    firedRef.current = false;
    lastTickRef.current = null;
    setEndsAt(Date.now() + targetSeconds * 1000);
    setLeft(targetSeconds);
    setPhase("running");
  };

  const stopEarly = () => {
    const doneSeconds = Math.round(targetSeconds - remainingFrom(endsAt));
    setPhase("finished");
    // 撐不完也要記，那才是有用的資訊
    onComplete(Math.max(0, doneSeconds));
  };

  if (phase === "running") {
    const pct = Math.min(100, Math.max(0, (1 - left / targetSeconds) * 100));
    return (
      <div className="hold-timer running">
        <div className="hold-bar" style={{ width: `${pct}%` }} />
        <div className="hold-body">
          <div className="hold-count">{formatSeconds(left)}</div>
          <button className="btn ghost small" type="button" onClick={stopEarly}>
            撐不住了，記到這裡
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      className="btn primary"
      type="button"
      onClick={start}
      disabled={busy}
    >
      {busy ? "儲存中…" : `開始計時 ${targetSeconds} 秒`}
    </button>
  );
}

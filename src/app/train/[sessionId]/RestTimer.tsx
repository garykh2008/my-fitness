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

// 組間休息倒數。完成一組後自動跳出來。
//
// 用「結束時間戳」而不是每秒遞減的計數器：手機把分頁凍結時 setInterval 會停掉，
// 回到前景時用時間戳重算才不會少數幾十秒。

export default function RestTimer({
  seconds,
  onDone,
  sound,
}: {
  seconds: number;
  onDone: () => void;
  sound: SoundSettings;
}) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  const firedRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const r = remainingFrom(endsAt);
      setLeft(r);

      // 最後幾秒每秒一聲短音，讓人知道要準備下一組了（秒數可在設定裡調）
      const t = shouldTick(r, lastTickRef.current, sound.tickFrom);
      if (t !== null) {
        lastTickRef.current = t;
        if (!sound.muted) playTick();
      }

      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        notifyDone(sound.muted);
      }
    };

    tick();
    const id = setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [endsAt, sound.tickFrom, sound.muted]);

  const done = left <= 0;
  const pct = Math.min(100, Math.max(0, (1 - left / seconds) * 100));

  const extend = (extra: number) => {
    unlockAudio();
    firedRef.current = false;
    lastTickRef.current = null;
    setEndsAt((prev) => Math.max(prev, Date.now()) + extra * 1000);
  };

  return (
    <div className={`rest-timer${done ? " done" : ""}`}>
      <div className="rest-bar" style={{ width: `${pct}%` }} />
      <div className="rest-body">
        <div className="rest-label">{done ? "休息結束" : "組間休息"}</div>
        <div className="rest-count">{formatSeconds(left)}</div>

        <div className="rest-actions">
          <button
            className="btn ghost small"
            type="button"
            onClick={() => extend(30)}
          >
            +30 秒
          </button>
          <button className="btn primary small" type="button" onClick={onDone}>
            {done ? "繼續" : "略過休息"}
          </button>
        </div>
      </div>
    </div>
  );
}

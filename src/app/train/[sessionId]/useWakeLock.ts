"use client";

import { useEffect, useRef } from "react";

// 練習中不要讓螢幕睡著 —— 記完一組放下手機、休息完拿起來還要重新解鎖很煩。
//
// Wake Lock 會在頁面切到背景時被系統收回，所以要在 visibilitychange 時重新申請。
// iOS Safari 16.4 以下沒有這個 API，抓到例外就安靜放棄（純加分功能，不該擋住訓練）。

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

export function useWakeLock(enabled = true) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const nav = navigator as Navigator & {
      wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        sentinelRef.current = await nav.wakeLock!.request("screen");
      } catch {
        // 電量過低或使用者設定不允許時會失敗，忽略即可
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [enabled]);
}

"use client";

import { useEffect, useState } from "react";

// 音效偏好。存在 localStorage：這是「這台裝置上的順手設定」，
// 不值得進資料庫，也不需要跨裝置同步（手機練、電腦看紀錄，需求本來就不同）。

export type TickFrom = 3 | 5 | 10;

export interface SoundSettings {
  muted: boolean;
  /** 倒數剩幾秒開始每秒報數 */
  tickFrom: TickFrom;
}

export const DEFAULT_SOUND: SoundSettings = { muted: false, tickFrom: 3 };

const STORAGE_KEY = "fitness.sound.v1";
const ALLOWED: TickFrom[] = [3, 5, 10];

function read(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SOUND;
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      muted: parsed.muted === true,
      tickFrom: ALLOWED.includes(parsed.tickFrom as TickFrom)
        ? (parsed.tickFrom as TickFrom)
        : DEFAULT_SOUND.tickFrom,
    };
  } catch {
    // 無痕視窗、封鎖網站資料、或存了壞掉的值都會走到這裡
    return DEFAULT_SOUND;
  }
}

export function useSoundSettings(): [
  SoundSettings,
  (patch: Partial<SoundSettings>) => void,
] {
  // 先用預設值渲染，掛載後才讀 localStorage ——
  // 直接在 useState 初始值裡讀會造成 server/client 內容不一致（hydration mismatch）
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SOUND);

  useEffect(() => {
    setSettings(read());
  }, []);

  const update = (patch: Partial<SoundSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 存不進去就算了，這次訓練還是照設定走
      }
      return next;
    });
  };

  return [settings, update];
}

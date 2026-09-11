"use client";

import { playTick, unlockAudio } from "./timer-utils";
import SoundIcon from "./SoundIcon";
import type { SoundSettings, TickFrom } from "./useSoundSettings";

// 按鈕與面板刻意拆成兩個元件。
//
// 按鈕要待在頂部那一列（跟進度數字並排），但面板必須是整行寬度 ——
// 兩個放在一起 render 的話，面板會變成那個 flex row 的 flex item，
// 被擠成一條細長的column。這是原本排版錯亂的原因。

const TICK_OPTIONS: TickFrom[] = [3, 5, 10];

export function SoundButton({
  settings,
  open,
  onToggleOpen,
}: {
  settings: SoundSettings;
  open: boolean;
  onToggleOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="sound-btn"
      onClick={onToggleOpen}
      aria-expanded={open}
      aria-label={settings.muted ? "音效設定（目前靜音）" : "音效設定"}
      title="音效設定"
    >
      <SoundIcon muted={settings.muted} />
    </button>
  );
}

export function SoundPanel({
  settings,
  onChange,
}: {
  settings: SoundSettings;
  onChange: (patch: Partial<SoundSettings>) => void;
}) {
  const setTickFrom = (n: TickFrom) => {
    onChange({ tickFrom: n });
    // 順手試聽一下，才知道自己選了什麼。
    // 這裡在點擊手勢裡，同時把 AudioContext 解鎖。
    unlockAudio();
    if (!settings.muted) playTick();
  };

  const toggleMute = () => {
    const nextMuted = !settings.muted;
    onChange({ muted: nextMuted });
    if (!nextMuted) {
      unlockAudio();
      playTick();
    }
  };

  return (
    <div className="sound-panel">
      <div className="sound-row">
        <span className="sound-label">音效</span>
        <div className="seg">
          <button
            type="button"
            className={!settings.muted ? "on" : ""}
            onClick={() => settings.muted && toggleMute()}
          >
            開
          </button>
          <button
            type="button"
            className={settings.muted ? "on" : ""}
            onClick={() => !settings.muted && toggleMute()}
          >
            靜音
          </button>
        </div>
      </div>

      <div className="sound-row">
        <span className="sound-label">倒數提示</span>
        <div className="seg">
          {TICK_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={settings.tickFrom === n ? "on" : ""}
              onClick={() => setTickFrom(n)}
              disabled={settings.muted}
            >
              {n}s
            </button>
          ))}
        </div>
      </div>

      <div className="sound-hint">
        剩下 {settings.tickFrom} 秒開始每秒一聲，時間到是三聲上行音。
        {settings.muted && " 靜音時仍然會震動。"}
      </div>
    </div>
  );
}

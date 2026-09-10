"use client";

// 計時器共用的小工具：格式化、音效、剩餘秒數計算。

/** 秒數寫成 mm:ss（或不到一分鐘時寫 "45 秒"） */
export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.ceil(total));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 用時間戳算剩餘秒數，而不是每秒 -1。
 * 手機把分頁凍結時 setInterval 會停掉或漂移，回來時用時間戳算才是對的。
 */
export function remainingFrom(endsAt: number): number {
  return Math.max(0, (endsAt - Date.now()) / 1000);
}

// --- 音效 -------------------------------------------------------
//
// 用 WebAudio 現場合成，不背音檔（幾個嗶聲不值得多送幾十 KB，
// 而且合成的音高長度都能隨時調）。
//
// 關鍵：iOS Safari 只允許在使用者手勢中建立／恢復 AudioContext。
// 所以共用同一個 context，並在「按下完成這組」「按下開始計時」的當下
// 呼叫 unlockAudio() 把它解鎖 —— 否則倒數到 0 時才建立會直接沒聲音。

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** 在使用者手勢中呼叫，讓之後的自動播放不會被瀏覽器擋掉。 */
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
}

interface ToneSpec {
  freq: number;
  /** 從現在起幾秒後發聲 */
  at?: number;
  duration?: number;
  volume?: number;
}

function playTones(tones: ToneSpec[]) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});

  const now = c.currentTime;

  for (const { freq, at = 0, duration = 0.12, volume = 0.22 } of tones) {
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const start = now + at;

      osc.type = "sine";
      osc.frequency.value = freq;

      // 直接切斷會有爆音，前後各做一小段淡入淡出
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain).connect(c.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // 單一個音失敗不需要讓整串停下來
    }
  }
}

/**
 * 倒數最後幾秒的提示音：短、低、輕，只是提醒「快到了」，
 * 不要跟時間到的聲音混淆。
 */
export function playTick() {
  playTones([{ freq: 620, duration: 0.07, volume: 0.16 }]);
}

/**
 * 時間到：三個上行音，明顯有別於倒數的單一短音。
 * 震動一起來，練習中手機常放在旁邊、也可能靜音。
 */
export function playDone() {
  playTones([
    { freq: 660, at: 0, duration: 0.13 },
    { freq: 880, at: 0.14, duration: 0.13 },
    { freq: 1175, at: 0.28, duration: 0.26, volume: 0.26 },
  ]);
}

/** 時間到的完整提示：聲音 + 震動 */
export function notifyDone() {
  playDone();
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // 桌機瀏覽器沒有震動，忽略
  }
}

/**
 * 倒數提示音的節流器：計時器每 200–250ms 跑一次，
 * 但每一秒只該響一次。回傳「這次要不要響」。
 */
export function shouldTick(
  secondsLeft: number,
  lastTicked: number | null,
  fromSecond = 3
): number | null {
  const s = Math.ceil(secondsLeft);
  if (s > fromSecond || s <= 0) return null;
  if (s === lastTicked) return null;
  return s;
}

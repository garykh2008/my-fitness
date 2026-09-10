"use client";

// 計時器共用的小工具。

/** 秒數寫成 mm:ss（或秒數不到一分鐘時就寫 "45 秒"） */
export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.ceil(total));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 時間到的提示。震動是主要手段（練習中手機常常在旁邊、聲音也可能被靜音），
 * 額外補一個短音，用 WebAudio 現場合成，免得為了一個 beep 去背一個音檔。
 */
export function notifyDone() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // 桌機瀏覽器沒有震動，忽略
  }

  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 880;
    // 直接切斷會有爆音，做個短的淡出
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    osc.onended = () => void ctx.close().catch(() => {});
  } catch {
    // 使用者還沒跟頁面互動過時 AudioContext 會被擋，忽略
  }
}

/**
 * 用時間戳算剩餘秒數，而不是每秒 -1。
 * 手機把分頁凍結時 setInterval 會停掉或漂移，回來時用時間戳算才是對的。
 */
export function remainingFrom(endsAt: number): number {
  return Math.max(0, (endsAt - Date.now()) / 1000);
}

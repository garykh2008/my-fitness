"use client";

import { useEffect } from "react";

// 註冊 service worker，讓瀏覽器願意提供「加到主畫面」。
// 註冊失敗不影響任何功能，安靜略過就好。

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // 本機用 http 開發時瀏覽器不見得允許，失敗就算了
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}

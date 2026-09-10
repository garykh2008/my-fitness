// 刻意保守的 service worker。
//
// 它存在的目的只是讓 app 可以「加到主畫面」，不是離線瀏覽。
// 這個站台的每一頁都是登入後的動態資料，把頁面快取起來只會在下次打開時
// 給出過期的訓練紀錄，甚至在登出後還看得到內容 —— 所以**只快取靜態圖示**，
// 其餘一律直接走網路。

const CACHE = "fitness-static-v1";

const ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 白名單以外的東西一律不碰，讓它照常走網路
  if (!ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

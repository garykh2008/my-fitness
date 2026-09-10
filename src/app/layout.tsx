import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "./ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "訓練紀錄",
  description: "個人運動紀錄平台",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "訓練紀錄",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#eef0ea",
  width: "device-width",
  initialScale: 1,
  // 練習中手滑放大很煩，但完全禁用會影響無障礙，只鎖最小縮放
  maximumScale: 5,
  // 加到主畫面後全螢幕開啟，要把瀏海／底部安全區讓出來
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <head>
        {/* 中文字體走 Google Fonts 的 CSS：它會把 CJK 切成 unicode-range 子集，
            瀏覽器只下載頁面真正用到的那幾塊。用 next/font 自架反而會把整份
            數 MB 的字重拉進 build，在這台 4GB 的 VPS 上不划算。 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@600;700&family=Noto+Sans+TC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

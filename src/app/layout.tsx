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
  themeColor: "#0f1115",
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
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

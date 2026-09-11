"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 訓練卡和動作庫是兩件不同的事：
// 訓練卡是「這次要怎麼練」，動作庫是「我會做哪些動作」。
// 分成兩個並列的頁面，不要讓動作庫只能從卡片編輯頁鑽進去。

const TABS = [
  { href: "/", label: "訓練卡" },
  { href: "/history", label: "紀錄" },
  { href: "/exercises", label: "動作庫" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {TABS.map((t) => {
        const active =
          t.href === "/"
            ? pathname === "/" || pathname.startsWith("/cards")
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`nav-tab${active ? " on" : ""}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

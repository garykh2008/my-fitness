"use client";

import { useState } from "react";
import {
  parseMediaUrl,
  youtubeEmbed,
  youtubeThumb,
  youtubeSearchUrl,
} from "@/lib/media";

// 動作示意。兩段式展開：
//   收合 → 什麼外部請求都不發
//   點開 → 只載入一張縮圖
//   再點 → 才真的載入播放器
//
// 一張課表有 7 個動作，一進頁面就塞 7 個 iframe 會拖垮手機，
// 所以連縮圖都要等使用者主動要求。

function PlayIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.25" />
      <path d="M10 8.6l5.2 3.4-5.2 3.4V8.6Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export default function MediaPreview({
  mediaUrl,
  nameZh,
  nameEn,
  /** true = 動作庫，直接顯示縮圖；false = 訓練頁，先收起來 */
  expandedByDefault = false,
}: {
  mediaUrl: string | null;
  nameZh: string;
  nameEn?: string | null;
  expandedByDefault?: boolean;
}) {
  const media = parseMediaUrl(mediaUrl);
  const [open, setOpen] = useState(expandedByDefault);
  const [playing, setPlaying] = useState(false);

  // 沒有連結：給搜尋，不要自己猜一支影片
  if (!media) {
    return (
      <a
        className="media-search"
        href={youtubeSearchUrl(nameZh, nameEn)}
        target="_blank"
        rel="noreferrer noopener"
      >
        <SearchIcon />
        搜尋示範影片
      </a>
    );
  }

  if (media.kind === "link") {
    return (
      <a
        className="media-search"
        href={media.url}
        target="_blank"
        rel="noreferrer noopener"
      >
        <SearchIcon />
        開啟示範連結
      </a>
    );
  }

  if (!open) {
    return (
      <button
        className="media-search"
        type="button"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
        看示意
      </button>
    );
  }

  return (
    <div className="media-frame">
      {playing ? (
        <iframe
          src={youtubeEmbed(media.id, media.start)}
          title={`${nameZh} 示範`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          className="media-thumb"
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`播放 ${nameZh} 的示範影片`}
        >
          {/* 縮圖是 YouTube 的固定網址，不需要 next/image 的最佳化 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={youtubeThumb(media.id)} alt="" loading="lazy" />
          <span className="media-play">
            <PlayIcon />
          </span>
        </button>
      )}
    </div>
  );
}

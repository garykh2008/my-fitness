"use client";

import { useEffect, useRef, useState } from "react";

// 滾輪選擇器。練習中用數字鍵盤很難用：鍵盤會蓋掉半個畫面，
// 手汗、戴手套的時候小按鍵也不好按。滾輪的觸控目標大得多。
//
// 作法是 CSS scroll-snap：上下各墊一段空白讓第一個和最後一個值也能置中，
// 選到的值就是捲動位置對應的索引。沒有用任何套件。

export const ITEM_HEIGHT = 34;
const VISIBLE = 5; // 奇數，正中間那格就是選取值

/** 產生等差數列，例如 range(0, 120, 0.5) */
export function range(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  // 用乘法而不是累加，避免 0.1 + 0.2 這種浮點誤差累積
  const n = Math.round((max - min) / step);
  for (let i = 0; i <= n; i++) {
    out.push(Math.round((min + i * step) * 100) / 100);
  }
  return out;
}

function nearestIndex(values: number[], value: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < values.length; i++) {
    const d = Math.abs(values[i] - value);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

export default function Wheel({
  label,
  unit,
  values,
  value,
  onChange,
}: {
  label: string;
  unit?: string;
  values: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => nearestIndex(values, value));
  const rafRef = useRef<number | null>(null);
  // 自己捲動時不要再被外部 value 拉回去，否則會打架
  const selfScrollRef = useRef(false);

  // 掛載時捲到目前的值
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = nearestIndex(values, value) * ITEM_HEIGHT;
    // 只在掛載時做一次；之後的同步交給下面那個 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部把值改掉時（例如切換到別組）跟著捲過去
  useEffect(() => {
    const el = ref.current;
    if (!el || selfScrollRef.current) return;
    const i = nearestIndex(values, value);
    if (i !== index) {
      setIndex(i);
      el.scrollTop = i * ITEM_HEIGHT;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    selfScrollRef.current = true;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const i = Math.max(
        0,
        Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT))
      );
      if (i !== index) {
        setIndex(i);
        onChange(values[i]);
      }
      selfScrollRef.current = false;
    });
  };

  const nudge = (delta: number) => {
    const el = ref.current;
    const i = Math.max(0, Math.min(values.length - 1, index + delta));
    if (i === index) return;
    setIndex(i);
    onChange(values[i]);
    if (el) el.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" });
  };

  const pad = ((VISIBLE - 1) / 2) * ITEM_HEIGHT;

  return (
    <div className="wheel-field">
      <div className="wheel-label">
        {label}
        {unit ? <span className="wheel-unit"> ({unit})</span> : null}
      </div>

      <div className="wheel-wrap">
        <button
          type="button"
          className="wheel-nudge"
          onClick={() => nudge(-1)}
          disabled={index === 0}
          aria-label={`${label} 減少`}
        >
          −
        </button>

        <div className="wheel-viewport" style={{ height: VISIBLE * ITEM_HEIGHT }}>
          {/* 正中間那格的框，純視覺，不吃事件 */}
          <div className="wheel-selection" style={{ height: ITEM_HEIGHT }} />

          <div
            className="wheel-scroll"
            ref={ref}
            onScroll={handleScroll}
            role="listbox"
            aria-label={label}
            tabIndex={0}
          >
            <div style={{ height: pad }} />
            {values.map((v, i) => (
              <div
                key={v}
                className={`wheel-item${i === index ? " on" : ""}`}
                style={{ height: ITEM_HEIGHT }}
                role="option"
                aria-selected={i === index}
              >
                {v}
              </div>
            ))}
            <div style={{ height: pad }} />
          </div>
        </div>

        <button
          type="button"
          className="wheel-nudge"
          onClick={() => nudge(1)}
          disabled={index === values.length - 1}
          aria-label={`${label} 增加`}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

// 音效圖示。原本用 🔊 / 🔇 emoji，但 emoji 是彩色點陣、字面造型各平台不一，
// 放在這套克制的排版語彙裡很突兀。改成描邊 SVG：線寬與圓角跟介面其他線條一致，
// 顏色用 currentColor 跟著按鈕的文字色走。

export default function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* 喇叭本體 */}
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />

      {muted ? (
        // 靜音：右邊打叉
        <>
          <path d="m15.5 10 4.5 4.5" />
          <path d="m20 10-4.5 4.5" />
        </>
      ) : (
        // 出聲：兩道由近而遠的音波
        <>
          <path d="M14.5 9.6a3.4 3.4 0 0 1 0 4.8" />
          <path d="M17.2 7.2a7 7 0 0 1 0 9.6" />
        </>
      )}
    </svg>
  );
}

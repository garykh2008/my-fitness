#!/usr/bin/env node
/**
 * 產生 PWA 圖示（PNG）。
 *
 * 只用 Node 內建的 zlib 手刻 PNG —— 為了三張純幾何的圖示去裝 sharp
 * （需要原生編譯、Docker build 會變慢）並不划算。
 *
 *   node scripts/make-icons.mjs
 *
 * 圖案：深色底 + 一支綠色啞鈴。改配色改下面的 BG / FG 即可。
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const BG = [15, 17, 21, 255]; // --bg  #0f1115
const FG = [74, 222, 128, 255]; // --accent #4ade80

// --- PNG 編碼 ---------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

/** pixels：長度 w*h*4 的 RGBA buffer */
function encodePng(w, h, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // 非交錯

  // 每條掃描線前面要加一個 filter byte，這裡一律用 0（None）
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const src = y * w * 4;
    const dst = y * (1 + w * 4);
    raw[dst] = 0;
    pixels.copy(raw, dst + 1, src, src + w * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- 畫圖 -------------------------------------------------------

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);

  const put = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) put(x, y, BG);
  }

  const rect = (x0, y0, x1, y1) => {
    for (let y = Math.round(y0); y < Math.round(y1); y++) {
      for (let x = Math.round(x0); x < Math.round(x1); x++) put(x, y, FG);
    }
  };

  // 啞鈴：中間橫桿 + 左右各兩片槓片（外片較短、內片較長）
  const s = size;
  const midY = s * 0.5;
  const barH = s * 0.075;
  rect(s * 0.3, midY - barH / 2, s * 0.7, midY + barH / 2);

  const innerH = s * 0.34;
  const outerH = s * 0.22;
  const plateW = s * 0.075;

  // 內側槓片
  rect(s * 0.235, midY - innerH / 2, s * 0.235 + plateW, midY + innerH / 2);
  rect(s * 0.69, midY - innerH / 2, s * 0.69 + plateW, midY + innerH / 2);
  // 外側槓片
  rect(s * 0.135, midY - outerH / 2, s * 0.135 + plateW, midY + outerH / 2);
  rect(s * 0.79, midY - outerH / 2, s * 0.79 + plateW, midY + outerH / 2);

  return encodePng(size, size, px);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const buf = makeIcon(size);
  writeFileSync(join(OUT_DIR, name), buf);
  console.log(`${name}  ${size}x${size}  ${buf.length} bytes`);
}

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.join(__dirname, 'assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// CRC32 Table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPNG(width, height, drawPixelFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // deflate
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // no interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawPixelFn(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idatChunk = makeChunk('IDAT', zlib.deflateSync(rawData, { level: 9 }));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function sdRoundRect(x, y, w, h, r) {
  const qx = Math.abs(x) - w + r;
  const qy = Math.abs(y) - h + r;
  const inside = Math.min(Math.max(qx, qy), 0);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return inside + outside - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return Math.hypot(dx, dy);
}

function renderZeroChartIcon(size, isMaskable = false) {
  return createPNG(size, size, (px, py, W, H) => {
    const u = px / W;
    const v = py / H;
    const cx = px - W / 2;
    const cy = py - H / 2;

    const bgR = Math.round(14 - v * 8);
    const bgG = Math.round(24 - v * 13);
    const bgB = Math.round(40 - v * 20);

    if (!isMaskable) {
      const radius = W * 0.24;
      const dSquircle = sdRoundRect(cx, cy, W * 0.46, H * 0.46, radius);
      if (dSquircle > 0) {
        return [0, 0, 0, 0];
      }
    }

    let r = bgR, g = bgG, b = bgB, a = 255;

    if (!isMaskable) {
      const radius = W * 0.24;
      const dBorder = Math.abs(sdRoundRect(cx, cy, W * 0.46, H * 0.46, radius));
      const borderThick = Math.max(2, W * 0.035);
      if (dBorder < borderThick) {
        const t = (u + v) * 0.5;
        const glowR = Math.round(0 * (1 - t) + 41 * t);
        const glowG = Math.round(229 * (1 - t) + 98 * t);
        const glowB = Math.round(255);
        return [glowR, glowG, glowB, 255];
      }
    }

    const gridAlpha = (Math.abs(v - 0.5) < 0.005 || Math.abs(v - 0.7) < 0.005 || Math.abs(u - 0.5) < 0.005) ? 0.12 : 0;
    if (gridAlpha > 0) {
      r = Math.round(r * (1 - gridAlpha) + 255 * gridAlpha);
      g = Math.round(g * (1 - gridAlpha) + 255 * gridAlpha);
      b = Math.round(b * (1 - gridAlpha) + 255 * gridAlpha);
    }

    const dWick1 = sdSegment(u, v, 0.30, 0.42, 0.30, 0.75);
    const dBody1 = sdRoundRect(px - W * 0.30, py - H * 0.58, W * 0.045, H * 0.10, 3);
    if (dWick1 < 0.015 || dBody1 <= 0) {
      return [41, 98, 255, 255];
    }

    const dWick2 = sdSegment(u, v, 0.48, 0.30, 0.48, 0.68);
    const dBody2 = sdRoundRect(px - W * 0.48, py - H * 0.48, W * 0.045, H * 0.12, 3);
    if (dWick2 < 0.015 || dBody2 <= 0) {
      return [0, 229, 255, 255];
    }

    const dWick3 = sdSegment(u, v, 0.66, 0.20, 0.66, 0.60);
    const dBody3 = sdRoundRect(px - W * 0.66, py - H * 0.39, W * 0.045, H * 0.13, 3);
    if (dWick3 < 0.015 || dBody3 <= 0) {
      return [0, 230, 118, 255];
    }

    let minArcDist = 999;
    for (let t = 0; t <= 1; t += 0.02) {
      const ax = (1 - t) * (1 - t) * 0.24 + 2 * (1 - t) * t * 0.52 + t * t * 0.80;
      const ay = (1 - t) * (1 - t) * 0.72 + 2 * (1 - t) * t * 0.58 + t * t * 0.24;
      const d = Math.hypot(u - ax, v - ay);
      if (d < minArcDist) minArcDist = d;
    }

    if (minArcDist < 0.028) {
      const blend = (u - 0.24) / 0.56;
      const arcR = Math.round(41 * (1 - blend) + 0 * blend);
      const arcG = Math.round(98 * (1 - blend) + 230 * blend);
      const arcB = Math.round(255 * (1 - blend) + 118 * blend);
      return [arcR, arcG, arcB, 255];
    }

    const headDist = Math.hypot(u - 0.80, v - 0.24);
    if (headDist < 0.045) {
      if (headDist < 0.025) return [255, 255, 255, 255];
      return [0, 229, 255, 255];
    }

    return [r, g, b, a];
  });
}

const p192 = renderZeroChartIcon(192, false);
fs.writeFileSync(path.join(assetsDir, 'icon-192.png'), p192);
console.log('✅ assets/icon-192.png generated (192x192)');

const p512 = renderZeroChartIcon(512, false);
fs.writeFileSync(path.join(assetsDir, 'icon-512.png'), p512);
console.log('✅ assets/icon-512.png generated (512x512)');

const pMaskable = renderZeroChartIcon(512, true);
fs.writeFileSync(path.join(assetsDir, 'icon-maskable-512.png'), pMaskable);
console.log('✅ assets/icon-maskable-512.png generated (512x512 maskable)');

const pApple = renderZeroChartIcon(180, false);
fs.writeFileSync(path.join(assetsDir, 'apple-touch-icon.png'), pApple);
console.log('✅ assets/apple-touch-icon.png generated (180x180)');

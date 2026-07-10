// Generates public/icon-192.png and public/icon-512.png with zero
// dependencies: a minimal PNG encoder (node zlib) drawing the speech-bubble
// mark from favicon.svg. Run once via `npm run icons`; outputs are committed.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// ---- PNG encoding ----

const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePNG(size, pixelAt) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1)
    raw[row] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y)
      const o = row + 1 + x * 3
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- geometry (mirrors public/favicon.svg, unit square coordinates) ----

const BLUE = [58, 90, 120] // #3a5a78
const WHITE = [255, 255, 255]

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.max(x0 + r, Math.min(x, x1 - r))
  const cy = Math.max(y0 + r, Math.min(y, y1 - r))
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2 || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r)
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx)
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx)
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)
}

function draw(size) {
  return encodePNG(size, (px, py) => {
    const x = (px + 0.5) / size // unit coordinates, 0–1
    const y = (py + 0.5) / size
    const bubble =
      inRoundedRect(x, y, 0.18, 0.2, 0.82, 0.6, 0.09) ||
      inTriangle(x, y, 0.3, 0.6, 0.46, 0.6, 0.3, 0.76)
    if (!bubble) return BLUE // full-bleed background → maskable-safe
    const lineXEnd = y > 0.45 ? 0.6 : 0.74
    const inLine =
      x >= 0.26 &&
      x <= lineXEnd &&
      [0.313, 0.403, 0.493].some((cy) => Math.abs(y - cy) <= 0.0225)
    return inLine ? BLUE : WHITE
  })
}

writeFileSync('public/icon-192.png', draw(192))
writeFileSync('public/icon-512.png', draw(512))
console.log('Wrote public/icon-192.png and public/icon-512.png')

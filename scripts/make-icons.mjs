// Rasterises Bubi's icons with signed-distance shapes — no image tools needed.
// Outputs icon/TrayTemplate.png (+@2x), icon/AppIcon.png and icon/AppIcon.icns.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT = path.join(import.meta.dirname, '..', 'icon')

// ── PNG encoding ────────────────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Shapes (unit space 0..1) ────────────────────────────────────────────────

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - dx * t, py - ay - dy * t)
}

function bezier(p0, p1, p2, p3, steps = 48) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    pts.push([
      u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
      u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
    ])
  }
  return pts
}

// A whip mark: chunky handle bottom-left, lash curling up and over into a crack.
const HANDLE = [[0.2, 0.86], [0.36, 0.58]]
const LASH = bezier([0.36, 0.58], [0.44, 0.1], [0.92, 0.06], [0.84, 0.46])
const SPARKS = [[[0.8, 0.6], [0.76, 0.7]], [[0.88, 0.58], [0.94, 0.66]], [[0.72, 0.5], [0.64, 0.54]]]

/** Coverage (0..1) of the whip mark at (x, y), with stroke widths in unit space. */
function whipCoverage(x, y, px, { handle, lashStart, lashEnd, spark }) {
  let d = segDist(x, y, ...HANDLE[0], ...HANDLE[1]) - handle / 2
  for (let i = 1; i < LASH.length; i++) {
    const t = i / (LASH.length - 1)
    const w = lashStart + (lashEnd - lashStart) * t
    d = Math.min(d, segDist(x, y, ...LASH[i - 1], ...LASH[i]) - w / 2)
  }
  for (const [a, b] of SPARKS) d = Math.min(d, segDist(x, y, ...a, ...b) - spark / 2)
  return Math.max(0, Math.min(1, 0.5 - d / px))
}

function roundedRectDist(x, y, inset, radius) {
  const qx = Math.abs(x - 0.5) - (0.5 - inset - radius)
  const qy = Math.abs(y - 0.5) - (0.5 - inset - radius)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

function render(size, shade) {
  const rgba = Buffer.alloc(size * size * 4)
  const SS = 3 // supersampling per axis
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = shade((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, 1 / size)
          r += cr * ca
          g += cg * ca
          b += cb * ca
          a += ca
        }
      }
      const i = (py * size + px) * 4
      const n = SS * SS
      rgba[i] = a ? Math.round(r / a) : 0
      rgba[i + 1] = a ? Math.round(g / a) : 0
      rgba[i + 2] = a ? Math.round(b / a) : 0
      rgba[i + 3] = Math.round((a / n) * 255)
    }
  }
  return encodePng(size, rgba)
}

// Template images: black + alpha only, macOS recolours them for the menu bar.
function trayShade(x, y, px) {
  return [0, 0, 0, whipCoverage(x, y, px, { handle: 0.2, lashStart: 0.13, lashEnd: 0.07, spark: 0.07 })]
}

function appShade(x, y, px) {
  const bg = roundedRectDist(x, y, 0.1, 0.18)
  const inside = Math.max(0, Math.min(1, 0.5 - bg / px))
  if (!inside) return [0, 0, 0, 0]
  // Warm sunset gradient.
  const t = y
  let col = [255 - 25 * t, 150 - 90 * t, 70 + 20 * t]
  const ix = (x - 0.5) / 0.8 + 0.5
  const iy = (y - 0.5) / 0.8 + 0.5
  const mark = whipCoverage(ix, iy, px / 0.8, { handle: 0.14, lashStart: 0.075, lashEnd: 0.03, spark: 0.04 })
  const shadow = whipCoverage(ix - 0.012, iy - 0.02, px / 0.8, { handle: 0.14, lashStart: 0.075, lashEnd: 0.03, spark: 0.04 })
  col = col.map(c => c * (1 - shadow * 0.25))
  const cream = [255, 247, 232]
  return [...col.map((c, i) => c + (cream[i] - c) * mark), inside]
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'TrayTemplate.png'), render(18, trayShade))
fs.writeFileSync(path.join(OUT, 'TrayTemplate@2x.png'), render(36, trayShade))
fs.writeFileSync(path.join(OUT, 'AppIcon.png'), render(1024, appShade))

const iconset = path.join(OUT, 'AppIcon.iconset')
fs.mkdirSync(iconset, { recursive: true })
const master = path.join(OUT, 'AppIcon.png')
for (const s of [16, 32, 128, 256, 512]) {
  for (const [suffix, px] of [['', s], ['@2x', s * 2]]) {
    execFileSync('sips', ['-z', String(px), String(px), master, '--out', path.join(iconset, `icon_${s}x${s}${suffix}.png`)], { stdio: 'ignore' })
  }
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(OUT, 'AppIcon.icns')])
fs.rmSync(iconset, { recursive: true })
console.log('icons written to', OUT)

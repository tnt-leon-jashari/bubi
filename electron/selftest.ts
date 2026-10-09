// Dev-only: BUBI_SELFTEST=<dir> replays a scripted flick instead of the real
// cursor and saves overlay frames to <dir>, so rendering can be checked headlessly.
// Nothing is ever typed — strikes need a real click.
import type { BrowserWindow } from 'electron'
import type { Point } from '../shared/ipc.js'
import fs from 'node:fs'
import path from 'node:path'

export function selftestCursor(start: number, origin: Point): Point {
  const t = (Date.now() - start) / 1000
  const k = Math.min(Math.max((t - 1.2) / 0.16, 0), 1)
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
  return { x: origin.x - Math.sin(e * Math.PI) * 300 + e * 520, y: origin.y - Math.sin(e * Math.PI) * 90 }
}

export function captureFrames(win: BrowserWindow, dir: string, atMs: number[]): void {
  fs.mkdirSync(dir, { recursive: true })
  for (const ms of atMs) {
    setTimeout(() => {
      void win.webContents.capturePage().then(img => fs.writeFileSync(path.join(dir, `frame-${ms}.png`), img.toPNG()))
    }, ms)
  }
}

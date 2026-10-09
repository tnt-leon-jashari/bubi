import type { Point } from '../shared/ipc'
import { describe, expect, it } from 'vitest'
import { createRope, detachRope, ropeOffscreen, settleRope, STEP_HZ, stepRope, thresholds } from '../renderer/src/physics/rope'

const bounds = { width: 1440, height: 900 }
const { crack, arm } = thresholds(1)

function peakTipSpeed(path: (t: number) => Point, seconds: number): number {
  const rope = createRope(path(0), { scale: 1 })
  settleRope(rope, path(0), bounds)
  let peak = 0
  for (let i = 0; i < seconds * STEP_HZ; i++) {
    stepRope(rope, path(i / STEP_HZ), bounds)
    peak = Math.max(peak, rope.tipSpeed)
  }
  return peak
}

/** Wind back, then snap forward over `duration` seconds — a real crack motion. */
function flick(distance: number, duration: number): (t: number) => Point {
  return (t) => {
    const k = Math.min(Math.max((t - 0.2) / duration, 0), 1)
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
    return { x: 700 - Math.sin(e * Math.PI) * distance * 0.6 + e * distance, y: 500 - Math.sin(e * Math.PI) * 80 }
  }
}

describe('rope physics', () => {
  it('stays calm when held still', () => {
    expect(peakTipSpeed(() => ({ x: 700, y: 500 }), 2)).toBeLessThan(arm / 4)
  })

  it('does not crack on slow or steady swinging', () => {
    expect(peakTipSpeed(t => ({ x: 700 + Math.sin(t * 2) * 150, y: 500 }), 3)).toBeLessThan(arm)
    expect(peakTipSpeed(t => ({ x: 700 + Math.sin(t * 6) * 150, y: 500 }), 3)).toBeLessThan(crack)
    expect(peakTipSpeed(flick(200, 0.35), 1.5)).toBeLessThan(crack)
  })

  it('cracks on a fast flick', () => {
    expect(peakTipSpeed(flick(400, 0.18), 1.5)).toBeGreaterThan(crack)
    expect(peakTipSpeed(flick(500, 0.12), 1.5)).toBeGreaterThan(crack)
  })

  it('stays numerically stable on a hard flick', () => {
    const rope = createRope({ x: 700, y: 400 }, { scale: 1 })
    const path = flick(500, 0.12)
    for (let i = 0; i < STEP_HZ; i++) stepRope(rope, path(i / STEP_HZ), bounds)
    for (let i = 0; i < rope.count; i++) {
      expect(Number.isFinite(rope.xs[i])).toBe(true)
      expect(Number.isFinite(rope.ys[i])).toBe(true)
    }
  })

  it('falls off screen once dropped', () => {
    const rope = createRope({ x: 700, y: 400 }, { scale: 1 })
    settleRope(rope, { x: 700, y: 400 }, bounds)
    detachRope(rope)
    let steps = 0
    while (!ropeOffscreen(rope, bounds.height) && steps < STEP_HZ * 5) {
      stepRope(rope, null, bounds)
      steps++
    }
    expect(ropeOffscreen(rope, bounds.height)).toBe(true)
  })
})

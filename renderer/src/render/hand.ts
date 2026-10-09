// Pat mode: a hand that springs after the cursor and squashes on each pat.
import type { Point } from '../../../shared/ipc'

export interface Hand {
  x: number
  y: number
  vx: number
  vy: number
  tilt: number
  squash: number
  waving: boolean
  waveT: number
}

const SPRING = 0.18
const FRICTION = 0.72
const WAVE_STEPS = 70

export function createHand(at: Point): Hand {
  return { x: at.x, y: at.y - 40, vx: 0, vy: 0, tilt: 0, squash: 0, waving: false, waveT: 0 }
}

/** Returns true once a goodbye wave has finished. */
export function stepHand(hand: Hand, target: Point, scale: number): boolean {
  const goalY = target.y - 40 * scale
  hand.vx = (hand.vx + (target.x - hand.x) * SPRING) * FRICTION
  hand.vy = (hand.vy + (goalY - hand.y) * SPRING) * FRICTION
  hand.x += hand.vx
  hand.y += hand.vy
  hand.tilt = hand.tilt * 0.8 + Math.max(-0.5, Math.min(0.5, hand.vx * 0.02)) * 0.2
  hand.squash *= 0.82
  if (!hand.waving) return false
  hand.waveT++
  return hand.waveT > WAVE_STEPS
}

export function patHand(hand: Hand): void {
  hand.squash = 1
}

export function waveGoodbye(hand: Hand): void {
  hand.waving = true
  hand.waveT = 0
}

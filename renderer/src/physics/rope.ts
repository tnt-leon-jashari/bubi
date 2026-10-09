// Verlet whip: a rigid handle held at the cursor plus a tapered lash of point
// masses. Units are px and fixed simulation steps (STEP_HZ per second).
import type { Point } from '../../../shared/ipc'

export const STEP_HZ = 120

export interface RopeOptions {
  /** Screen-size multiplier; 1 ≈ a 900px-tall display. */
  scale: number
  points?: number
  iterations?: number
}

export interface Rope {
  readonly xs: Float32Array
  readonly ys: Float32Array
  readonly count: number
  grip: Point
  handleTip: Point
  handleLength: number
  scale: number
  attached: boolean
  /** Fastest of the last two lash points this step, px/step. */
  tipSpeed: number
}

interface RopeInternals extends Rope {
  pxs: Float32Array
  pys: Float32Array
  invMass: Float32Array
  restLength: Float32Array
  maxBend: Float32Array
  iterations: number
  handleAngle: number
  gripVx: number
  gripVy: number
  smoothVx: number
}

const GRAVITY = 0.09
const DAMPING = 0.99
const HANDLE_EASE = 0.22
// Held up and forward, like a real grip.
const REST_HANDLE_ANGLE = -Math.PI / 4
const BEND_STIFFNESS = 0.5
const HANDLE_JOINT_BEND = 2.6

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

export function createRope(at: Point, { scale, points = 36, iterations = 24 }: RopeOptions): Rope {
  const count = points
  const lashLength = clamp(470 * scale, 260, 620)
  const handleLength = 52 * scale

  const restLength = new Float32Array(count)
  const invMass = new Float32Array(count)
  const maxBend = new Float32Array(count)
  let total = 0
  for (let i = 1; i < count; i++) {
    const t = i / (count - 1)
    restLength[i] = 1.3 - 0.6 * t // longer links near the handle
    total += restLength[i] ?? 0
  }
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    restLength[i] = ((restLength[i] ?? 0) / total) * lashLength
    // Mass tapers toward the tip so a travelling loop accelerates into a crack.
    invMass[i] = i === 0 ? 0 : 1 / lerp(1.2, 0.18, t)
    // The handle joint hinges freely; past it, stiff near the handle and loose toward the tip (radians between links).
    maxBend[i] = i === 1 ? HANDLE_JOINT_BEND : lerp(0.32, 0.95, t)
  }

  const xs = new Float32Array(count)
  const ys = new Float32Array(count)
  const handleAngle = REST_HANDLE_ANGLE
  const tipX = at.x + Math.cos(handleAngle) * handleLength
  const tipY = at.y + Math.sin(handleAngle) * handleLength
  // Lay the lash out as a smooth droop from the handle direction so it never
  // starts folded (a fold would be locked in place by the bend constraint).
  let angle = handleAngle
  xs[0] = tipX
  ys[0] = tipY
  for (let i = 1; i < count; i++) {
    const turn = Math.PI / 2 - angle
    angle += Math.sign(turn) * Math.min(Math.abs(turn), (maxBend[i] ?? 0) * 0.7)
    xs[i] = (xs[i - 1] ?? 0) + Math.cos(angle) * (restLength[i] ?? 0)
    ys[i] = (ys[i - 1] ?? 0) + Math.sin(angle) * (restLength[i] ?? 0)
  }

  const rope: RopeInternals = {
    xs,
    ys,
    pxs: xs.slice(),
    pys: ys.slice(),
    count,
    invMass,
    restLength,
    maxBend,
    iterations,
    grip: { ...at },
    handleTip: { x: tipX, y: tipY },
    handleLength,
    handleAngle,
    scale,
    attached: true,
    tipSpeed: 0,
    gripVx: 0,
    gripVy: 0,
    smoothVx: 0,
  }
  return rope
}

function internals(rope: Rope): RopeInternals {
  return rope as RopeInternals
}

/** Moves the grip to the cursor and swings the handle with the hand's motion. */
function updateHandle(r: RopeInternals, target: Point | null): void {
  if (r.attached && target) {
    r.gripVx = target.x - r.grip.x
    r.gripVy = target.y - r.grip.y
    r.grip.x = target.x
    r.grip.y = target.y
  }
  else {
    // Dropped: the handle falls and tumbles with the lash.
    r.gripVy += GRAVITY * 3 * r.scale
    r.gripVx *= 0.99
    r.grip.x += r.gripVx
    r.grip.y += r.gripVy
  }
  r.smoothVx = lerp(r.smoothVx, r.gripVx, 0.35)
  const tilt = clamp(r.smoothVx * 0.05 / r.scale, -1.25, 1.25)
  const targetAngle = r.attached ? REST_HANDLE_ANGLE + tilt : r.handleAngle + 0.08
  r.handleAngle = lerp(r.handleAngle, targetAngle, HANDLE_EASE)
  r.handleTip.x = r.grip.x + Math.cos(r.handleAngle) * r.handleLength
  r.handleTip.y = r.grip.y + Math.sin(r.handleAngle) * r.handleLength
}

function integrate(r: RopeInternals): void {
  const g = GRAVITY * r.scale
  for (let i = 1; i < r.count; i++) {
    const x = r.xs[i] ?? 0
    const y = r.ys[i] ?? 0
    const vx = (x - (r.pxs[i] ?? 0)) * DAMPING
    const vy = (y - (r.pys[i] ?? 0)) * DAMPING
    r.pxs[i] = x
    r.pys[i] = y
    r.xs[i] = x + vx
    r.ys[i] = y + vy + g
  }
}

function solveDistance(r: RopeInternals): void {
  for (let i = 1; i < r.count; i++) {
    const a = i - 1
    const dx = (r.xs[i] ?? 0) - (r.xs[a] ?? 0)
    const dy = (r.ys[i] ?? 0) - (r.ys[a] ?? 0)
    const dist = Math.hypot(dx, dy) || 1e-6
    const wa = r.invMass[a] ?? 0
    const wb = r.invMass[i] ?? 0
    const diff = (dist - (r.restLength[i] ?? 0)) / (dist * (wa + wb))
    r.xs[a] = (r.xs[a] ?? 0) + dx * diff * wa
    r.ys[a] = (r.ys[a] ?? 0) + dy * diff * wa
    r.xs[i] = (r.xs[i] ?? 0) - dx * diff * wb
    r.ys[i] = (r.ys[i] ?? 0) - dy * diff * wb
  }
}

/**
 * Limits bending with a minimum distance between every other point: links
 * a–b–c may not fold tighter than maxBend. The grip stands in for point -1.
 */
function solveBend(r: RopeInternals): void {
  for (let i = 1; i < r.count; i++) {
    const b = i - 1
    const ax = b === 0 ? r.grip.x : (r.xs[b - 1] ?? 0)
    const ay = b === 0 ? r.grip.y : (r.ys[b - 1] ?? 0)
    const la = b === 0 ? r.handleLength : (r.restLength[b] ?? 0)
    const lb = r.restLength[i] ?? 0
    const bend = r.maxBend[i] ?? 1
    const minDist = Math.sqrt(la * la + lb * lb + 2 * la * lb * Math.cos(bend))
    const dx = (r.xs[i] ?? 0) - ax
    const dy = (r.ys[i] ?? 0) - ay
    const dist = Math.hypot(dx, dy) || 1e-6
    if (dist >= minDist) continue
    const wa = b === 0 ? 0 : (r.invMass[b - 1] ?? 0)
    const wc = r.invMass[i] ?? 0
    const diff = ((dist - minDist) / (dist * (wa + wc))) * BEND_STIFFNESS
    if (b > 0) {
      r.xs[b - 1] = (r.xs[b - 1] ?? 0) + dx * diff * wa
      r.ys[b - 1] = (r.ys[b - 1] ?? 0) + dy * diff * wa
    }
    r.xs[i] = (r.xs[i] ?? 0) - dx * diff * wc
    r.ys[i] = (r.ys[i] ?? 0) - dy * diff * wc
  }
}

function collideWalls(r: RopeInternals, bounds: { width: number, height: number }): void {
  if (!r.attached) return // let a dropped whip fall off screen
  for (let i = 1; i < r.count; i++) {
    const x = r.xs[i] ?? 0
    const y = r.ys[i] ?? 0
    const cx = clamp(x, 0, bounds.width)
    const cy = clamp(y, 0, bounds.height)
    if (cx !== x || cy !== y) {
      r.xs[i] = cx
      r.ys[i] = cy
      // Friction: bleed off most of the velocity along the wall.
      r.pxs[i] = lerp(r.pxs[i] ?? cx, cx, 0.6)
      r.pys[i] = lerp(r.pys[i] ?? cy, cy, 0.6)
    }
  }
}

function measureTip(r: RopeInternals): number {
  let fastest = 0
  for (let i = r.count - 2; i < r.count; i++) {
    const speed = Math.hypot((r.xs[i] ?? 0) - (r.pxs[i] ?? 0), (r.ys[i] ?? 0) - (r.pys[i] ?? 0))
    fastest = Math.max(fastest, speed)
  }
  return fastest
}

/** Advances one fixed step. `target` is the cursor; null keeps the grip where it is. */
export function stepRope(rope: Rope, target: Point | null, bounds: { width: number, height: number }): void {
  const r = internals(rope)
  updateHandle(r, target)
  integrate(r)
  for (let k = 0; k < r.iterations; k++) {
    r.xs[0] = r.handleTip.x
    r.ys[0] = r.handleTip.y
    solveDistance(r)
    solveBend(r)
  }
  r.xs[0] = r.handleTip.x
  r.ys[0] = r.handleTip.y
  collideWalls(r, bounds)
  r.tipSpeed = measureTip(r)
}

/** Runs the sim in place so a freshly spawned whip hangs naturally instead of unfolding on screen. */
export function settleRope(rope: Rope, at: Point, bounds: { width: number, height: number }, steps = STEP_HZ * 2): void {
  for (let i = 0; i < steps; i++) stepRope(rope, at, bounds)
  const r = internals(rope)
  r.pxs.set(r.xs)
  r.pys.set(r.ys)
  r.tipSpeed = 0
}

export function detachRope(rope: Rope): void {
  rope.attached = false
}

/** True once every point (and the handle) has fallen below the bottom edge. */
export function ropeOffscreen(rope: Rope, height: number): boolean {
  if (rope.grip.y < height + 40) return false
  for (let i = 0; i < rope.count; i++) {
    if ((rope.ys[i] ?? 0) < height + 40) return false
  }
  return true
}

/** Crack and strike thresholds in px/step, scaled to the display. */
export function thresholds(scale: number): { crack: number, arm: number } {
  return { crack: 60 * scale, arm: 40 * scale }
}

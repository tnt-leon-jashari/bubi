// Sparks, shockwave rings and floating hearts, simulated in the same fixed steps as the rope.
import type { Point } from '../../../shared/ipc'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  kind: 'spark' | 'heart' | 'sparkle'
  glyph?: string
}

export interface Ring {
  x: number
  y: number
  radius: number
  life: number
}

export interface FxState {
  particles: Particle[]
  rings: Ring[]
  flash: number
}

const HEART_GLYPHS = ['❤️', '💖', '💕', '💗'] as const
const MAX_PARTICLES = 400

export function createFx(): FxState {
  return { particles: [], rings: [], flash: 0 }
}

function push(fx: FxState, p: Particle): void {
  if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift()
  fx.particles.push(p)
}

/** Burst at the whip tip; `power` ≥ 1 scales with how far past the crack threshold it was. */
export function crackBurst(fx: FxState, at: Point, direction: Point, power: number, scale: number): void {
  const count = Math.round(18 + power * 14)
  const baseAngle = Math.atan2(direction.y, direction.x)
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (Math.random() - 0.5) * Math.PI * 1.4
    const speed = (2 + Math.random() * 7 * power) * scale
    push(fx, {
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 30 + Math.random() * 40,
      size: (1 + Math.random() * 2.2) * scale,
      kind: 'spark',
    })
  }
  fx.rings.push({ x: at.x, y: at.y, radius: 6 * scale, life: 1 })
  fx.flash = Math.min(1, 0.35 + power * 0.25)
}

export function patBurst(fx: FxState, at: Point, scale: number): void {
  for (let i = 0; i < 6; i++) {
    push(fx, {
      x: at.x + (Math.random() - 0.5) * 50 * scale,
      y: at.y - 20 * scale,
      vx: (Math.random() - 0.5) * 1.2 * scale,
      vy: -(1 + Math.random() * 1.4) * scale,
      life: 0,
      maxLife: 90 + Math.random() * 50,
      size: (18 + Math.random() * 16) * scale,
      kind: i < 4 ? 'heart' : 'sparkle',
      glyph: i < 4 ? HEART_GLYPHS[i % HEART_GLYPHS.length] : '✨',
    })
  }
}

export function stepFx(fx: FxState, scale: number): void {
  fx.particles = fx.particles.filter((p) => {
    p.life++
    p.x += p.vx
    p.y += p.vy
    if (p.kind === 'spark') {
      p.vx *= 0.95
      p.vy = p.vy * 0.95 + 0.08 * scale
    }
    else {
      p.vx += Math.sin(p.life * 0.08) * 0.03 * scale // gentle drift
      p.vy *= 0.995
    }
    return p.life < p.maxLife
  })
  fx.rings = fx.rings.filter((r) => {
    r.radius += 5.5 * scale
    r.life -= 0.035
    return r.life > 0
  })
  fx.flash = Math.max(0, fx.flash - 0.06)
}

export function fxActive(fx: FxState): boolean {
  return fx.particles.length > 0 || fx.rings.length > 0 || fx.flash > 0
}

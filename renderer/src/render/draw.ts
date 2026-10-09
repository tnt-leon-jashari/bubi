import type { Rope } from '../physics/rope'
import type { FxState } from '../fx/particles'
import type { Hand } from './hand'

const LEATHER_DARK = '#24150a'
const LEATHER = '#4a2c16'
const LEATHER_LIGHT = '#7a4a26'
const POPPER = '#f3e3c3'

function strokeLash(g: CanvasRenderingContext2D, rope: Rope, offsetX: number, offsetY: number, color: (t: number) => string): void {
  const s = rope.scale
  for (let i = 1; i < rope.count; i++) {
    const t = i / (rope.count - 1)
    g.strokeStyle = color(t)
    g.lineWidth = (7.5 - 5.8 * t) * s
    g.beginPath()
    g.moveTo((rope.xs[i - 1] ?? 0) + offsetX, (rope.ys[i - 1] ?? 0) + offsetY)
    g.lineTo((rope.xs[i] ?? 0) + offsetX, (rope.ys[i] ?? 0) + offsetY)
    g.stroke()
  }
}

export function drawWhip(g: CanvasRenderingContext2D, rope: Rope): void {
  const s = rope.scale
  g.lineCap = 'round'
  g.lineJoin = 'round'

  // Soft drop shadow so the whip reads on any wallpaper.
  strokeLash(g, rope, 4 * s, 7 * s, () => 'rgba(0,0,0,0.16)')
  g.strokeStyle = 'rgba(0,0,0,0.18)'
  g.lineWidth = 13 * s
  g.beginPath()
  g.moveTo(rope.grip.x + 4 * s, rope.grip.y + 7 * s)
  g.lineTo(rope.handleTip.x + 4 * s, rope.handleTip.y + 7 * s)
  g.stroke()

  strokeLash(g, rope, 0, 0, t => (t < 0.5 ? LEATHER_DARK : LEATHER))
  // Highlight pass gives the braid a rounded, leathery look.
  g.globalAlpha = 0.35
  strokeLash(g, rope, -0.8 * s, -0.8 * s, t => (t < 0.85 ? LEATHER_LIGHT : 'transparent'))
  g.globalAlpha = 1

  // Popper tuft at the tip.
  const n = rope.count - 1
  const tx = rope.xs[n] ?? 0
  const ty = rope.ys[n] ?? 0
  const angle = Math.atan2(ty - (rope.ys[n - 1] ?? ty), tx - (rope.xs[n - 1] ?? tx))
  g.strokeStyle = POPPER
  g.lineWidth = 1.6 * s
  for (const spread of [-0.35, 0, 0.35]) {
    g.beginPath()
    g.moveTo(tx, ty)
    g.lineTo(tx + Math.cos(angle + spread) * 11 * s, ty + Math.sin(angle + spread) * 11 * s)
    g.stroke()
  }

  // Handle with grip wraps.
  const hx = rope.handleTip.x - rope.grip.x
  const hy = rope.handleTip.y - rope.grip.y
  g.strokeStyle = LEATHER
  g.lineWidth = 11 * s
  g.beginPath()
  g.moveTo(rope.grip.x - hx * 0.12, rope.grip.y - hy * 0.12)
  g.lineTo(rope.handleTip.x, rope.handleTip.y)
  g.stroke()
  g.strokeStyle = LEATHER_DARK
  g.lineWidth = 2 * s
  const px = -hy / rope.handleLength
  const py = hx / rope.handleLength
  for (let k = 0; k <= 5; k++) {
    const t = k / 5 * 0.75
    const cx = rope.grip.x + hx * t
    const cy = rope.grip.y + hy * t
    g.beginPath()
    g.moveTo(cx - px * 5.5 * s, cy - py * 5.5 * s)
    g.lineTo(cx + px * 5.5 * s, cy + py * 5.5 * s)
    g.stroke()
  }
  g.fillStyle = LEATHER_DARK
  g.beginPath()
  g.arc(rope.grip.x - hx * 0.12, rope.grip.y - hy * 0.12, 6.5 * s, 0, Math.PI * 2)
  g.fill()
}

export function drawHand(g: CanvasRenderingContext2D, hand: Hand, scale: number): void {
  const size = 92 * scale
  g.save()
  g.translate(hand.x, hand.y + hand.squash * 16 * scale)
  g.rotate(hand.tilt + (hand.waving ? Math.sin(hand.waveT * 0.35) * 0.45 : 0))
  g.scale(1 + hand.squash * 0.08, 1 - hand.squash * 0.14)
  g.font = `${size}px "Apple Color Emoji"`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = 'rgba(0,0,0,0.25)'
  g.shadowBlur = 14 * scale
  g.shadowOffsetY = 6 * scale
  g.fillText(hand.waving ? '👋' : '🫳', 0, 0)
  g.restore()
}

export function drawFx(g: CanvasRenderingContext2D, fx: FxState, width: number, height: number, scale: number): void {
  if (fx.flash > 0) {
    g.fillStyle = `rgba(255, 240, 200, ${fx.flash * 0.08})`
    g.fillRect(0, 0, width, height)
  }
  for (const r of fx.rings) {
    g.strokeStyle = `rgba(255, 244, 214, ${r.life * 0.8})`
    g.lineWidth = 3 * scale * r.life
    g.beginPath()
    g.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
    g.stroke()
  }
  for (const p of fx.particles) {
    const fade = 1 - p.life / p.maxLife
    if (p.kind === 'spark') {
      g.strokeStyle = `rgba(255, ${180 + Math.round(fade * 60)}, 90, ${fade})`
      g.lineWidth = p.size
      g.beginPath()
      g.moveTo(p.x, p.y)
      g.lineTo(p.x - p.vx * 1.8, p.y - p.vy * 1.8)
      g.stroke()
    }
    else if (p.glyph) {
      g.globalAlpha = Math.min(1, fade * 1.6)
      g.font = `${p.size}px "Apple Color Emoji"`
      g.textAlign = 'center'
      g.fillText(p.glyph, p.x, p.y)
      g.globalAlpha = 1
    }
  }
}

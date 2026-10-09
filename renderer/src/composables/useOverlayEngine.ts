import type { Ref } from 'vue'
import type { Mode, Point, SpawnPayload } from '../../../shared/ipc'
import type { Rope } from '../physics/rope'
import type { Hand } from '../render/hand'
import { useDevicePixelRatio, useEventListener, useRafFn, useThrottleFn, useWindowSize } from '@vueuse/core'
import { onMounted, watch } from 'vue'
import { playCrack, playPat, playWhoosh } from '../fx/audio'
import { playHitSound } from '../fx/hitSounds'
import { createFx, crackBurst, fxActive, patBurst, stepFx } from '../fx/particles'
import { createRope, detachRope, ropeOffscreen, settleRope, STEP_HZ, stepRope, thresholds } from '../physics/rope'
import { drawFx, drawHand, drawWhip } from '../render/draw'
import { createHand, patHand, stepHand, waveGoodbye } from '../render/hand'
import { useOverlayStore } from '../stores/overlay'

// After a crack, any click while its phrase is on screen sends it.
const STRIKE_WINDOW_MS = 1800
const CRACK_COOLDOWN_MS = 450
const WHOOSH_COOLDOWN_MS = 350
const ENTRANCE_MS = 550
const DROP_TIMEOUT_MS = 2500
const MAX_STEPS_PER_FRAME = 8

type Phase = 'hidden' | 'active' | 'dropping'

export interface OverlayEngine {
  switchMode: (next?: Mode) => void
}

/** Runs the whip / hand simulation on `canvas` and wires it to the main process bridge. */
export function useOverlayEngine(canvas: Ref<HTMLCanvasElement | null>): OverlayEngine {
  const store = useOverlayStore()
  const bridge = window.bubi
  const { width, height } = useWindowSize()
  const { pixelRatio } = useDevicePixelRatio()

  let phase: Phase = 'hidden'
  let rope: Rope | null = null
  let hand: Hand | null = null
  const fx = createFx()
  const cursor: Point = { x: 0, y: 0 }
  let entrance: { from: Point, startedAt: number } | null = null
  let droppedAt = 0
  let armedUntil = 0
  let lastCrackAt = 0
  let lastWhooshAt = 0
  let lastEffectAt: Point = { x: 0, y: 0 }
  let accumulator = 0

  const scale = (): number => Math.max(0.7, Math.min(1.6, height.value / 900))
  const bounds = (): { width: number, height: number } => ({ width: width.value, height: height.value })

  function resizeCanvas(): void {
    const el = canvas.value
    if (!el) return
    el.width = Math.round(width.value * pixelRatio.value)
    el.height = Math.round(height.value * pixelRatio.value)
  }

  function spawnTool(mode: Mode, at: Point): void {
    store.setMode(mode)
    if (mode === 'whip') {
      rope = createRope(at, { scale: scale() })
      settleRope(rope, at, bounds())
      hand = null
    }
    else {
      hand = createHand(at)
      rope = null
    }
  }

  function spawn({ mode, fromLeft, cursor: at }: SpawnPayload): void {
    Object.assign(cursor, at)
    entrance = fromLeft ? { from: { x: -160 * scale(), y: at.y }, startedAt: performance.now() } : null
    spawnTool(mode, entrance ? entrance.from : at)
    phase = 'active'
    store.show(mode)
    resume()
  }

  function drop(): void {
    if (phase !== 'active') return
    phase = 'dropping'
    droppedAt = performance.now()
    if (rope) detachRope(rope)
    if (hand) waveGoodbye(hand)
  }

  function finishHide(): void {
    phase = 'hidden'
    rope = null
    hand = null
    store.hide()
    bridge.hidden()
  }

  function switchMode(next?: Mode): void {
    if (phase !== 'active') return
    const mode = next ?? (store.mode === 'whip' ? 'pat' : 'whip')
    if (mode === store.mode) return
    spawnTool(mode, cursor)
    bridge.modeChanged(mode)
  }

  /** Where the tool currently is: animated entrance target, else the cursor. */
  function target(now: number): Point {
    if (!entrance) return cursor
    const k = Math.min(1, (now - entrance.startedAt) / ENTRANCE_MS)
    if (k >= 1) entrance = null
    const e = 1 - (1 - k) ** 3
    return { x: entrance ? entrance.from.x + (cursor.x - entrance.from.x) * e : cursor.x, y: cursor.y }
  }

  function tipPoint(r: Rope): Point {
    return { x: r.xs[r.count - 1] ?? 0, y: r.ys[r.count - 1] ?? 0 }
  }

  function stepWhip(r: Rope, now: number): void {
    stepRope(r, phase === 'active' ? target(now) : null, bounds())
    if (phase !== 'active') return
    const { crack, arm } = thresholds(r.scale)
    if (r.tipSpeed > crack && now - lastCrackAt > CRACK_COOLDOWN_MS) {
      lastCrackAt = now
      armedUntil = now + STRIKE_WINDOW_MS
      const tip = tipPoint(r)
      const n = r.count - 1
      const power = r.tipSpeed / crack
      crackBurst(fx, tip, { x: tip.x - (r.xs[n - 1] ?? 0), y: tip.y - (r.ys[n - 1] ?? 0) }, power, r.scale)
      lastEffectAt = tip
      playCrack(power)
      bridge.crack()
    }
    else if (r.tipSpeed > arm && now - lastWhooshAt > WHOOSH_COOLDOWN_MS && now - lastCrackAt > CRACK_COOLDOWN_MS) {
      lastWhooshAt = now
      playWhoosh(r.tipSpeed / crack)
    }
  }

  function step(now: number): void {
    const s = scale()
    if (rope) stepWhip(rope, now)
    if (hand && stepHand(hand, target(now), s)) finishHide()
    stepFx(fx, s)

    if (phase === 'dropping' && rope) {
      const gone = ropeOffscreen(rope, height.value) || now - droppedAt > DROP_TIMEOUT_MS
      if (gone && !fxActive(fx)) finishHide()
    }
  }

  function render(): void {
    const el = canvas.value
    const g = el?.getContext('2d')
    if (!el || !g) return
    g.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0)
    g.clearRect(0, 0, width.value, height.value)
    drawFx(g, fx, width.value, height.value, scale())
    if (rope) drawWhip(g, rope)
    if (hand) drawHand(g, hand, scale())
  }

  const { pause, resume } = useRafFn(({ delta }) => {
    if (phase === 'hidden') {
      render()
      pause()
      return
    }
    accumulator = Math.min(accumulator + delta, (MAX_STEPS_PER_FRAME * 1000) / STEP_HZ)
    const stepMs = 1000 / STEP_HZ
    while (accumulator >= stepMs) {
      step(performance.now())
      accumulator -= stepMs
    }
    render()
  }, { immediate: false })

  // ── Input (the panel never takes focus, but it does get clicks; the cursor comes from main) ──

  useEventListener(window, 'mousedown', (e: MouseEvent) => {
    if (phase !== 'active') return
    if (e.button === 1) {
      switchMode()
      return
    }
    if (e.button !== 0) return
    const now = performance.now()
    if (rope && now <= armedUntil) {
      armedUntil = 0
      const tip = tipPoint(rope)
      crackBurst(fx, tip, { x: 0, y: -1 }, 1.6, rope.scale)
      lastEffectAt = tip
      playCrack(1.8)
      store.recordStrike()
      bridge.strike()
    }
    else if (hand) {
      patHand(hand)
      patBurst(fx, { x: hand.x, y: hand.y }, scale())
      lastEffectAt = { x: hand.x, y: hand.y }
      playPat()
      store.recordPat()
      bridge.pat()
    }
  })

  useEventListener(window, 'contextmenu', (e: MouseEvent) => {
    e.preventDefault()
    drop()
  })

  useEventListener(window, 'wheel', useThrottleFn(() => switchMode(), 400), { passive: true })

  // ── Bridge ────────────────────────────────────────────────────────────────

  onMounted(() => {
    resizeCanvas()
    bridge.onSpawn(spawn)
    bridge.onDrop(drop)
    bridge.onSetMode(mode => switchMode(mode))
    bridge.onCursor((p) => {
      cursor.x = p.x
      cursor.y = p.y
    })
    bridge.onBanner(({ text, kind }) => {
      const at = kind === 'warn' ? { x: width.value / 2, y: height.value * 0.3 } : lastEffectAt
      store.showBanner(text, kind, at)
    })
    bridge.onYelp(({ sound, streak }) => playHitSound(sound, streak))
  })

  watch([width, height, pixelRatio], resizeCanvas)

  return { switchMode }
}

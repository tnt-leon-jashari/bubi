// Hit reaction presets, all synthesised. Every recipe escalates with `level`
// (0 = a single hit … MAX_LEVEL = a full-on combo) so rapid whipping feels
// increasingly rewarding: higher, louder, more layers, plus milestone flourishes.
import type { HitSoundId } from '../../../shared/ipc'
import { audio } from './audio'

export const MAX_LEVEL = 6

export interface HitSound {
  label: string
  description: string
  emoji: string
}

export const HIT_SOUNDS: Record<HitSoundId, HitSound> = {
  squeaky: { label: 'Squeaky toy', description: 'Rubber chew-toy squeaks that multiply and climb.', emoji: '🧸' },
  arcade: { label: 'Arcade combo', description: 'Retro blips up a scale, with a fanfare on every combo milestone.', emoji: '🕹️' },
  bonk: { label: 'Cartoon bonk', description: 'Wood-block bonk, then a boing, then a slide whistle.', emoji: '🔨' },
  punch: { label: 'Big punch', description: 'Meaty thump that gets crunchier, ending in a K.O. bell.', emoji: '🥊' },
  puppy: { label: 'Puppy yip', description: 'Short squeaky yips that turn into a dramatic whine.', emoji: '🐶' },
  cat: { label: 'Angry cat', description: 'A grumpy "mrrow" that ends in a hiss.', emoji: '🐱' },
  robot: { label: 'Robot glitch', description: 'Bit-crushed beeps that spiral into an error meltdown.', emoji: '🤖' },
  laser: { label: 'Laser zap', description: 'Sci-fi pew-pews with echo and a power-up sweep.', emoji: '⚡' },
}

type Recipe = (out: AudioNode, t: number, level: number) => void

// ── Building blocks ─────────────────────────────────────────────────────────

const ctx = (): AudioContext => audio().ctx
const rand = (min: number, max: number): number => min + Math.random() * (max - min)

/** Gain node with an attack / hold / exponential release envelope, wired to `out`. */
function env(out: AudioNode, t: number, peak: number, attack: number, hold: number, release: number): GainNode {
  const g = ctx().createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack)
  g.gain.setValueAtTime(Math.max(peak, 0.0002), t + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release)
  g.connect(out)
  return g
}

/** Oscillator following `[time offset, frequency]` points (exponential glides). */
function tone(type: OscillatorType, to: AudioNode, t: number, duration: number, points: readonly (readonly [number, number])[]): OscillatorNode {
  const o = ctx().createOscillator()
  o.type = type
  points.forEach(([offset, freq], i) => {
    if (i === 0) o.frequency.setValueAtTime(freq, t + offset)
    else o.frequency.exponentialRampToValueAtTime(freq, t + offset)
  })
  o.connect(to)
  o.start(t)
  o.stop(t + duration + 0.05)
  return o
}

function vibrato(target: OscillatorNode, t: number, duration: number, rate: number, depth: number): void {
  const lfo = ctx().createOscillator()
  lfo.frequency.value = rate
  const d = ctx().createGain()
  d.gain.value = depth
  lfo.connect(d).connect(target.frequency)
  lfo.start(t)
  lfo.stop(t + duration + 0.05)
}

function noise(to: AudioNode, t: number, duration: number): AudioBufferSourceNode {
  const src = ctx().createBufferSource()
  src.buffer = audio().noise
  src.loop = true
  src.connect(to)
  src.start(t)
  src.stop(t + duration + 0.05)
  return src
}

function filter(type: BiquadFilterType, frequency: number, q: number, to: AudioNode): BiquadFilterNode {
  const f = ctx().createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = q
  f.connect(to)
  return f
}

function distortion(amount: number, to: AudioNode): WaveShaperNode {
  const shaper = ctx().createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x))
  }
  shaper.curve = curve
  shaper.connect(to)
  return shaper
}

function echo(to: AudioNode, time: number, feedback: number): AudioNode {
  const input = ctx().createGain()
  const delay = ctx().createDelay(1)
  delay.delayTime.value = time
  const fb = ctx().createGain()
  fb.gain.value = feedback
  input.connect(to)
  input.connect(delay)
  delay.connect(fb).connect(delay)
  delay.connect(to)
  return input
}

const semitone = (base: number, steps: number): number => base * 2 ** (steps / 12)
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16] as const

// ── Recipes ─────────────────────────────────────────────────────────────────

const squeak = (out: AudioNode, t: number, base: number, length: number, peak: number): void => {
  const body = filter('bandpass', base * 1.8, 5, env(out, t, peak, 0.01, length * 0.5, length * 0.5))
  const o = tone('square', body, t, length, [[0, base], [length * 0.35, base * 1.55], [length, base * 1.15]])
  vibrato(o, t, length, 38, base * 0.03)
}

const RECIPES: Record<HitSoundId, Recipe> = {
  squeaky(out, t, level) {
    const count = 1 + Math.floor(level / 2)
    for (let i = 0; i < count; i++) {
      squeak(out, t + i * 0.1, 950 + level * 90 + i * 60, rand(0.1, 0.14), 0.3 + level * 0.03)
    }
    if (level >= MAX_LEVEL - 1) {
      const start = t + count * 0.1
      const body = filter('bandpass', 3000, 4, env(out, start, 0.32, 0.01, 0.25, 0.2))
      vibrato(tone('square', body, start, 0.46, [[0, 1200], [0.4, 2600]]), start, 0.46, 30, 60)
    }
  },

  arcade(out, t, level) {
    const lead = env(out, t, 0.14 + level * 0.01, 0.003, 0.06, 0.08)
    const note = semitone(523.25, PENTATONIC[Math.min(level, PENTATONIC.length - 1)] ?? 0)
    tone('square', lead, t, 0.14, [[0, note]])
    tone('square', env(out, t + 0.06, 0.12 + level * 0.01, 0.003, 0.05, 0.1), t + 0.06, 0.16, [[0, note * 1.5]])
    if (level > 0 && level % 3 === 0) {
      // Combo milestone: quick fanfare arpeggio.
      ;[0, 4, 7, 12, 16, 19].slice(0, level === MAX_LEVEL ? 6 : 4).forEach((step, i) => {
        const at = t + 0.2 + i * 0.065
        tone('square', env(out, at, 0.13, 0.003, 0.04, 0.12), at, 0.18, [[0, semitone(note, step)]])
      })
    }
  },

  bonk(out, t, level) {
    const pitch = 700 + rand(-60, 60) + level * 40
    tone('sine', env(out, t, 0.6, 0.002, 0.01, 0.12), t, 0.15, [[0, pitch * 1.6], [0.02, pitch]])
    tone('sine', env(out, t, 0.25, 0.002, 0, 0.06), t, 0.08, [[0, pitch * 2.7]])
    noise(filter('bandpass', 2500, 1, env(out, t, 0.3, 0.001, 0, 0.02)), t, 0.03)
    if (level >= 2) {
      const at = t + 0.08
      const spring = tone('sine', env(out, at, 0.3, 0.01, 0.15, 0.3), at, 0.46, [[0, 220 + level * 20]])
      vibrato(spring, at, 0.46, 13, 90)
    }
    if (level >= 4) {
      const at = t + 0.3
      tone('sine', env(out, at, 0.28, 0.02, 0.4, 0.2), at, 0.62, [[0, 2200], [0.6, 260]])
    }
  },

  punch(out, t, level) {
    const crunch = level >= 3 ? distortion(4 + level * 4, out) : out
    tone('sine', env(crunch, t, 0.85, 0.002, 0.03, 0.22), t, 0.26, [[0, 160 + level * 10], [0.18, 38]])
    noise(filter('lowpass', 1400 + level * 300, 0.8, env(crunch, t, 0.5 + level * 0.04, 0.001, 0.01, 0.09)), t, 0.12)
    noise(filter('highpass', 4000, 0.7, env(out, t, 0.25, 0.001, 0, 0.015)), t, 0.02)
    if (level >= 2) noise(filter('bandpass', 900, 0.8, env(out, t, 0.08, 0.06, 0, 0.05)), t, 0.12)
    if (level === MAX_LEVEL) {
      const at = t + 0.18
      for (const [f, peak] of [[1760, 0.22], [2640, 0.12], [3520, 0.06]] as const) {
        tone('sine', env(out, at, peak, 0.002, 0.02, 1.2), at, 1.25, [[0, f]])
      }
    }
  },

  puppy(out, t, level) {
    const yips = 1 + Math.min(level, 3)
    for (let i = 0; i < yips; i++) {
      const at = t + i * 0.11
      const base = 1150 + level * 70 + rand(-60, 60)
      const voice = filter('bandpass', 2400, 3, env(out, at, 0.32 + level * 0.03, 0.006, 0.02, 0.06))
      tone('triangle', voice, at, 0.09, [[0, base * 0.8], [0.02, base * 1.4], [0.08, base * 0.9]])
      noise(filter('highpass', 3000, 0.5, env(out, at, 0.04, 0.005, 0.01, 0.04)), at, 0.06)
    }
    if (level >= 4) {
      const at = t + yips * 0.11
      const whine = tone('triangle', filter('bandpass', 2000, 2.5, env(out, at, 0.3, 0.04, 0.35, 0.25)), at, 0.66, [[0, 1500], [0.6, 700]])
      vibrato(whine, at, 0.66, 7, 45)
    }
  },

  cat(out, t, level) {
    const length = 0.38 + level * 0.03
    const g = env(out, t, 0.32 + level * 0.03, 0.04, length * 0.5, length * 0.4)
    const formant = filter('bandpass', 800, 4, g)
    formant.frequency.setValueAtTime(700, t)
    formant.frequency.linearRampToValueAtTime(1500, t + length * 0.4)
    formant.frequency.linearRampToValueAtTime(900, t + length)
    const base = 480 + level * 40
    const o = tone('sawtooth', formant, t, length, [[0, base], [length * 0.4, base * 1.7], [length, base * 0.9]])
    vibrato(o, t, length, level >= 2 ? 24 : 6, level >= 2 ? 40 : 15) // growl on repeat hits
    if (level >= 4) {
      const at = t + length * 0.9
      noise(filter('highpass', 3500, 0.7, env(out, at, 0.18, 0.03, 0.25 + level * 0.03, 0.2)), at, 0.55)
    }
  },

  robot(out, t, level) {
    const crushed = distortion(30, filter('lowpass', 5000, 0.5, env(out, t, 0.12, 0.003, 0.06 * (3 + level), 0.05)))
    const steps = 4 + level * 2
    const o = ctx().createOscillator()
    o.type = 'square'
    for (let i = 0; i < steps; i++) o.frequency.setValueAtTime(rand(300, 900 + level * 250), t + i * 0.025)
    o.connect(crushed)
    o.start(t)
    o.stop(t + steps * 0.025 + 0.05)
    if (level >= 4) {
      ;[880, 660, 440, 330].slice(0, level - 2).forEach((f, i) => {
        const at = t + steps * 0.025 + 0.04 + i * 0.12
        tone('square', env(out, at, 0.1, 0.003, 0.07, 0.03), at, 0.11, [[0, f]])
      })
    }
  },

  laser(out, t, level) {
    const wet = echo(out, 0.09, 0.25 + level * 0.06)
    const zaps = 1 + Math.floor(level / 2)
    for (let i = 0; i < zaps; i++) {
      const at = t + i * 0.09
      tone('sawtooth', filter('lowpass', 6000, 1, env(wet, at, 0.16, 0.002, 0.02, 0.15)), at, 0.18, [[0, 2600 + level * 200], [0.17, 140]])
    }
    if (level >= 4) {
      const at = t + zaps * 0.09 + 0.05
      tone('square', filter('lowpass', 3000, 2, env(wet, at, 0.1, 0.05, 0.25, 0.1)), at, 0.4, [[0, 200], [0.38, 1800]])
    }
  },
}

let master: GainNode | null = null

/** Plays a hit reaction; `level` is clamped to 0..MAX_LEVEL. */
export function playHitSound(id: HitSoundId, level: number): void {
  const c = ctx()
  if (!master) {
    master = c.createGain()
    master.gain.value = 0.9
    master.connect(c.destination)
  }
  RECIPES[id](master, c.currentTime + 0.01, Math.max(0, Math.min(MAX_LEVEL, Math.round(level))))
}

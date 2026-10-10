// Real recorded hit reactions (CC0 — see assets/sounds/CREDITS.md). Each
// preset escalates over the hit streak: light → medium → big, with extra
// layers and a K.O. bell at the top of a combo.
import type { RealSoundId } from '../../../shared/ipc'

const urls = import.meta.glob<string>('../assets/sounds/**/*.mp3', { eager: true, query: '?url', import: 'default' })

/** Clip names like `voice/light-1`, mapped to their bundled URLs. */
export const CLIPS: Record<string, string> = Object.fromEntries(
  Object.entries(urls).map(([path, url]) => [path.replace('../assets/sounds/', '').replace('.mp3', ''), url]),
)

// Decoded audio is cached by the browser; keeping one element per clip makes repeat plays instant.
const primed = new Map<string, HTMLAudioElement>()

function element(name: string): HTMLAudioElement | null {
  const url = CLIPS[name]
  if (!url) return null
  let base = primed.get(name)
  if (!base) {
    base = new Audio(url)
    base.preload = 'auto'
    primed.set(name, base)
  }
  // Clone so the same clip can overlap itself on rapid hits.
  return base.cloneNode() as HTMLAudioElement
}

export interface ClipOptions {
  volume?: number
  /** Playback rate; also shifts pitch (higher = more panicked). */
  rate?: number
  delayMs?: number
}

export function playClip(name: string, { volume = 1, rate = 1, delayMs = 0 }: ClipOptions = {}): void {
  const audio = element(name)
  if (!audio) return
  audio.volume = Math.max(0, Math.min(1, volume))
  audio.preservesPitch = false
  audio.playbackRate = rate
  const start = (): void => void audio.play().catch(() => undefined)
  if (delayMs > 0) setTimeout(start, delayMs)
  else start()
}

/** Warms every clip so the first hit doesn't lag. */
export function preloadClips(): void {
  for (const name of Object.keys(CLIPS)) element(name)
}

function pick(prefix: string): string {
  const names = Object.keys(CLIPS).filter(n => n.startsWith(prefix))
  return names[Math.floor(Math.random() * names.length)] ?? ''
}

const jitter = (amount: number): number => 1 + (Math.random() - 0.5) * amount

type Tier = 'light' | 'medium' | 'big'

function tier(level: number): Tier {
  if (level < 2) return 'light'
  if (level < 4) return 'medium'
  return 'big'
}

const IMPACT: Record<Tier, string> = { light: 'impact/slap', medium: 'impact/punch', big: 'impact/heavy' }

function voice(level: number, delayMs = 0): void {
  // Pitch creeps up with the streak so a combo sounds increasingly desperate.
  playClip(pick(`voice/${tier(level)}`), { volume: 0.7 + level * 0.05, rate: jitter(0.08) + level * 0.015, delayMs })
}

export const SAMPLE_RECIPES: Record<RealSoundId, (level: number) => void> = {
  ouch(level) {
    voice(level)
    if (level === 6) voice(4, 220) // a second, overlapping yelp at full combo
  },

  brawl(level) {
    playClip(pick(IMPACT[tier(level)]), { volume: 0.75 + level * 0.04, rate: jitter(0.1) })
    voice(level, 70)
    if (level === 6) playClip('impact/bell', { volume: 0.7, delayMs: 160 })
  },

  slapstick(level) {
    playClip(pick(IMPACT[tier(level)]), { volume: 0.75 + level * 0.04, rate: jitter(0.1) })
    if (level < 2) playClip(pick('toy/squeak'), { volume: 0.6, rate: jitter(0.15) + level * 0.05, delayMs: 40 })
    else playClip(pick('toy/boing'), { volume: 0.8, rate: jitter(0.1) + (level - 2) * 0.06, delayMs: 50 })
    if (level >= 4) playClip(pick('toy/squeak'), { volume: 0.7, rate: 1.1 + (level - 4) * 0.08, delayMs: 200 })
    if (level === 6) playClip('impact/bell', { volume: 0.7, delayMs: 320 })
  },
}

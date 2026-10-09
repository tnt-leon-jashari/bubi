import type { HitSoundId } from '../../../shared/ipc'
import type { Ref } from 'vue'
import { onUnmounted, ref } from 'vue'
import { playCrack } from '../fx/audio'
import { MAX_LEVEL, playHitSound } from '../fx/hitSounds'

// Same rule as the app: hits less than this apart build a streak.
const STREAK_MS = 1800

export interface HitCombo {
  streak: Ref<number>
  /** Bumps on every hit so the pad can re-trigger its pop animation. */
  pulse: Ref<number>
  hit: () => void
  playLevel: (level: number) => void
  playFullCombo: () => void
}

/** A hit pad that escalates like rapid whipping does in the overlay. */
export function useHitCombo(sound: () => HitSoundId, withCrack: () => boolean): HitCombo {
  const streak = ref(0)
  const pulse = ref(0)
  let lastHitAt = 0
  let resetTimer: ReturnType<typeof setTimeout> | null = null
  const comboTimers: ReturnType<typeof setTimeout>[] = []

  function playLevel(level: number): void {
    if (withCrack()) playCrack(1 + level * 0.15)
    playHitSound(sound(), level)
    streak.value = level
    pulse.value++
  }

  function hit(): void {
    const now = performance.now()
    const level = now - lastHitAt < STREAK_MS ? Math.min(streak.value + 1, MAX_LEVEL) : 0
    lastHitAt = now
    playLevel(level)
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => (streak.value = 0), STREAK_MS)
  }

  function playFullCombo(): void {
    for (let level = 0; level <= MAX_LEVEL; level++) comboTimers.push(setTimeout(() => playLevel(level), level * 420))
    comboTimers.push(setTimeout(() => (streak.value = 0), MAX_LEVEL * 420 + STREAK_MS))
  }

  onUnmounted(() => {
    if (resetTimer) clearTimeout(resetTimer)
    comboTimers.forEach(clearTimeout)
  })

  return { streak, pulse, hit, playLevel, playFullCombo }
}

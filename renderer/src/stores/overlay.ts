import type { BannerKind, Mode, Point } from '../../../shared/ipc'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Banner {
  id: number
  text: string
  kind: BannerKind
  at: Point
  note?: string
}

const BANNER_MS = 1800
const WARN_BANNER_MS = 5000
const HINT_MS = 4500

export const useOverlayStore = defineStore('overlay', () => {
  const mode = ref<Mode>('whip')
  const visible = ref(false)
  const banner = ref<Banner | null>(null)
  const patCount = ref(0)
  const strikeCount = ref(0)
  const hintVisible = ref(false)

  const isPat = computed(() => mode.value === 'pat')

  let bannerTimer: ReturnType<typeof setTimeout> | null = null
  let hintTimer: ReturnType<typeof setTimeout> | null = null
  let nextId = 1

  function show(next: Mode): void {
    mode.value = next
    visible.value = true
    hintVisible.value = true
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => (hintVisible.value = false), HINT_MS)
  }

  function hide(): void {
    visible.value = false
    hintVisible.value = false
    banner.value = null
  }

  function setMode(next: Mode): void {
    mode.value = next
  }

  function showBanner(text: string, kind: BannerKind, at: Point, note?: string): void {
    banner.value = { id: nextId++, text, kind, at: { ...at }, note }
    if (bannerTimer) clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => (banner.value = null), kind === 'warn' ? WARN_BANNER_MS : BANNER_MS)
  }

  function recordPat(): void {
    patCount.value++
  }

  function recordStrike(): void {
    strikeCount.value++
  }

  return { mode, visible, banner, patCount, strikeCount, hintVisible, isPat, show, hide, setMode, showBanner, recordPat, recordStrike }
})

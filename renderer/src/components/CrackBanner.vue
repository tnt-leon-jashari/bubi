<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="scale-50 opacity-0"
    leave-active-class="transition duration-300 ease-in"
    leave-to-class="-translate-y-4 opacity-0"
  >
    <div
      v-if="banner"
      :key="banner.id"
      class="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
      :style="position"
    >
      <p
        class="max-w-md rounded-2xl px-5 py-2.5 text-center text-2xl font-black tracking-tight shadow-2xl ring-1"
        :class="toneClass"
      >
        {{ banner.text }}
      </p>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { BannerKind } from '../../../shared/ipc'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useOverlayStore } from '../stores/overlay'

const TONES: Record<BannerKind, string> = {
  whip: 'bg-leather-950/90 text-spark ring-spark/40 -rotate-2',
  pat: 'bg-white/95 text-heart ring-heart/30 rotate-1',
  warn: 'bg-amber-400 text-amber-950 ring-amber-700/40 text-lg',
}

const { banner } = storeToRefs(useOverlayStore())

const toneClass = computed(() => (banner.value ? TONES[banner.value.kind] : ''))

const position = computed(() => {
  if (!banner.value) return {}
  const { x, y } = banner.value.at
  const margin = 220
  return {
    left: `${Math.min(Math.max(x, margin), window.innerWidth - margin)}px`,
    top: `${Math.max(y - 30, 90)}px`,
  }
})
</script>

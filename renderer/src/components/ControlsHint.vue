<template>
  <Transition enter-from-class="translate-y-3 opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-300" leave-active-class="transition duration-700">
    <div
      v-if="hintVisible"
      class="pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2 text-sm font-semibold text-white"
    >
      <span v-for="hint in hints" :key="hint" class="rounded-full bg-black/60 px-3 py-1.5 backdrop-blur">
        {{ hint }}
      </span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useOverlayStore } from '../stores/overlay'

const { hintVisible, isPat } = storeToRefs(useOverlayStore())

const hints = computed(() =>
  isPat.value
    ? ['Click to pat', 'Scroll to switch', 'Right-click to wave bye']
    : ['Flick fast to crack', 'Click while the phrase shows to send it', 'Scroll to switch', 'Right-click to drop'],
)
</script>

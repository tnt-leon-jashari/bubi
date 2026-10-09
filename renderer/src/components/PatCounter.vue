<template>
  <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition" leave-active-class="transition">
    <div
      v-if="visible && isPat && patCount > 0"
      class="pointer-events-none absolute right-8 bottom-8 rounded-full bg-white/90 px-4 py-2 text-lg font-bold text-heart shadow-xl"
    >
      🫶 {{ patCount }} {{ patCount === 1 ? 'pat' : 'pats' }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useOverlayStore } from '../stores/overlay'

const { visible, isPat, patCount } = storeToRefs(useOverlayStore())
</script>

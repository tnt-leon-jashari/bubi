<template>
  <section class="flex flex-col gap-3">
    <h2 class="text-xl font-bold">
      All clips
    </h2>
    <p class="-mt-2 text-sm text-stone-400">
      Every raw recording the real presets are built from. Click to hear one.
    </p>
    <div v-for="group in groups" :key="group.name" class="flex flex-wrap items-center gap-1.5">
      <span class="w-16 text-sm font-semibold text-stone-400 capitalize">{{ group.name }}</span>
      <button
        v-for="clip in group.clips"
        :key="clip"
        type="button"
        class="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-xs transition hover:bg-white/20 active:scale-95"
        :class="{ 'bg-spark! text-leather-950': lastPlayed === clip }"
        @click="play(clip)"
      >
        {{ clip.split('/')[1] }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { CLIPS, playClip } from '../fx/samples'

const lastPlayed = ref<string | null>(null)

const groups = computed(() => {
  const byFolder = new Map<string, string[]>()
  for (const name of Object.keys(CLIPS).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const folder = name.split('/')[0] ?? ''
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), name])
  }
  return [...byFolder].map(([name, clips]) => ({ name, clips }))
})

function play(clip: string): void {
  lastPlayed.value = clip
  playClip(clip)
}
</script>

<template>
  <main class="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-black tracking-tight">
          Bubi sound lab
        </h1>
        <p class="text-stone-400">
          Pick what the agent sounds like when you hit it. Hit a pad fast and it escalates, just like rapid whipping.
        </p>
      </div>
      <label class="flex items-center gap-2 text-sm text-stone-300">
        <input v-model="withCrack" type="checkbox" class="size-4 accent-amber-400">
        Play the whip crack too
      </label>
    </header>

    <section v-for="section in sections" :key="section.title" class="flex flex-col gap-3">
      <h2 class="text-xl font-bold">
        {{ section.title }}
      </h2>
      <div class="grid gap-4 md:grid-cols-2">
        <SoundCard
          v-for="id in section.ids"
          :id="id"
          :key="id"
          :selected="id === selected"
          :with-crack="withCrack"
          @choose="choose"
        />
      </div>
    </section>

    <ClipBrowser />
  </main>
</template>

<script setup lang="ts">
import type { HitSoundId } from '../../../shared/ipc'
import { onMounted, ref } from 'vue'
import { REAL_SOUND_IDS, SYNTH_SOUND_IDS } from '../../../shared/ipc'
import { preloadClips } from '../fx/samples'
import ClipBrowser from './ClipBrowser.vue'
import SoundCard from './SoundCard.vue'

const sections = [
  { title: 'Real recordings', ids: REAL_SOUND_IDS },
  { title: 'Synthesised', ids: SYNTH_SOUND_IDS },
] as const

const selected = ref<HitSoundId | null>(null)
const withCrack = ref(true)

function choose(id: HitSoundId): void {
  selected.value = id
  window.bubiLab?.setHitSound(id)
}

onMounted(async () => {
  preloadClips()
  selected.value = (await window.bubiLab?.getHitSound()) ?? null
})
</script>

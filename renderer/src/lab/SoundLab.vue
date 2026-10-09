<template>
  <main class="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
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

    <section class="grid gap-4 md:grid-cols-2">
      <SoundCard
        v-for="id in HIT_SOUND_IDS"
        :id="id"
        :key="id"
        :selected="id === selected"
        :with-crack="withCrack"
        @choose="choose"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import type { HitSoundId } from '../../../shared/ipc'
import { onMounted, ref } from 'vue'
import { HIT_SOUND_IDS } from '../../../shared/ipc'
import SoundCard from './SoundCard.vue'

const selected = ref<HitSoundId | null>(null)
const withCrack = ref(true)

function choose(id: HitSoundId): void {
  selected.value = id
  window.bubiLab?.setHitSound(id)
}

onMounted(async () => {
  selected.value = (await window.bubiLab?.getHitSound()) ?? null
})
</script>

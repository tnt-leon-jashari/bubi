<template>
  <article
    class="flex flex-col gap-4 rounded-3xl p-5 ring-1 transition"
    :class="selected ? 'bg-spark/10 ring-spark' : 'bg-white/5 ring-white/10'"
  >
    <header class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold">
          {{ sound.emoji }} {{ sound.label }}
        </h2>
        <p class="text-sm text-stone-400">
          {{ sound.description }}
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-full px-3 py-1 text-sm font-semibold transition"
        :class="selected ? 'bg-spark text-leather-950' : 'bg-white/10 hover:bg-white/20'"
        @click="emit('choose', id)"
      >
        {{ selected ? 'In use ✓' : 'Use this' }}
      </button>
    </header>

    <button
      type="button"
      class="relative grid h-32 place-items-center overflow-hidden rounded-2xl bg-leather-800 text-4xl font-black text-white shadow-inner transition active:scale-95"
      :style="padStyle"
      @mousedown.prevent="combo.hit"
    >
      <span :key="combo.pulse.value" class="animate-[pop_0.25s_ease-out]">
        {{ combo.streak.value > 0 ? `x${combo.streak.value + 1}` : 'HIT ME' }}
      </span>
      <span class="absolute bottom-2 text-xs font-semibold tracking-widest text-white/50 uppercase">
        click fast to build a combo
      </span>
    </button>

    <div class="flex items-center gap-1.5">
      <span class="mr-1 text-xs text-stone-500">Level</span>
      <button
        v-for="level in levels"
        :key="level"
        type="button"
        class="size-8 rounded-lg text-sm font-bold transition hover:bg-white/20"
        :class="combo.streak.value === level && combo.pulse.value ? 'bg-spark text-leather-950' : 'bg-white/10'"
        @click="combo.playLevel(level)"
      >
        {{ level + 1 }}
      </button>
      <button
        type="button"
        class="ml-auto rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20"
        @click="combo.playFullCombo"
      >
        ▶ Full combo
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { HitSoundId } from '../../../shared/ipc'
import { computed } from 'vue'
import { HIT_SOUNDS, MAX_LEVEL } from '../fx/hitSounds'
import { useHitCombo } from './useHitCombo'

const props = defineProps<{
  id: HitSoundId
  selected: boolean
  withCrack: boolean
}>()

const emit = defineEmits<{
  choose: [id: HitSoundId]
}>()

const sound = computed(() => HIT_SOUNDS[props.id])
const levels = Array.from({ length: MAX_LEVEL + 1 }, (_, i) => i)
const combo = useHitCombo(() => props.id, () => props.withCrack)

// The pad heats up from leather brown to hot orange as the combo grows.
const padStyle = computed(() => {
  const heat = combo.streak.value / MAX_LEVEL
  return {
    backgroundColor: `hsl(${25 - heat * 20} ${45 + heat * 50}% ${20 + heat * 30}%)`,
    transform: `scale(${1 + heat * 0.04})`,
  }
})
</script>

<style>
@keyframes pop {
  from {
    transform: scale(1.6);
    opacity: 0.4;
  }
}
</style>

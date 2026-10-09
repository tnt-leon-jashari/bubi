<template>
  <div class="relative h-full w-full">
    <canvas ref="canvas" class="absolute inset-0 h-full w-full" />
    <CrackBanner />
    <PatCounter />
    <ControlsHint />
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import ControlsHint from './components/ControlsHint.vue'
import CrackBanner from './components/CrackBanner.vue'
import PatCounter from './components/PatCounter.vue'
import { useOverlayEngine } from './composables/useOverlayEngine'

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
useOverlayEngine(canvas)
</script>

<script setup>
// Індикатор активності в стилі Apple (iOS / macOS): 8 пелюсток, що по черзі згасають.
// Обертання кроками (steps) — як системний UIActivityIndicatorView: читається як «система працює».
defineProps({ size: { type: Number, default: 15 } })
const PETALS = Array.from({ length: 8 }, (_, i) => i)
</script>

<template>
  <svg class="sp" :width="size" :height="size" viewBox="0 0 24 24" role="progressbar" aria-hidden="true">
    <rect v-for="i in PETALS" :key="i" x="11" y="2" width="2.2" height="6.4" rx="1.1"
          :transform="`rotate(${i * 45} 12 12)`" :opacity="0.18 + (i / 7) * 0.82" />
  </svg>
</template>

<style scoped>
.sp{flex:none;fill:currentColor;animation:sp-rot .9s steps(8) infinite}
@keyframes sp-rot{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.sp{animation-duration:2.4s}}
</style>

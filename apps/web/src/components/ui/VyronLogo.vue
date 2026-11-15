<script setup>
// Знак Vyron — монограма VD (assets/logo.js). Колір силуету — фірмовий колір теми (--brand),
// тож логотип змінюється разом із дизайном.
import { SHAPE, V } from '@vyron/shared/logo'
defineProps({ size: { type: Number, default: 28 } })
</script>

<template>
  <svg class="vl" :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true">
    <path class="sh" :d="SHAPE" />
    <path class="v" :d="V" />
  </svg>
</template>

<style scoped>
.vl{display:block;flex:none}
.sh{fill:var(--brand);transition:fill var(--t-mid) var(--ease-out)}
.v{fill:none;stroke:#fff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
</style>

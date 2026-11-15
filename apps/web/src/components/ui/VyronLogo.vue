<script setup>
// Знак Vyron (assets/logo.js). Колір шестикутника — фірмовий колір теми (--brand), тож логотип змінюється разом із дизайном.
import { HEX, V } from '../../assets/logo'
defineProps({ size: { type: Number, default: 28 } })
</script>

<template>
  <svg class="vl" :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true">
    <polygon class="hx" :points="HEX" />
    <path class="v" :d="V" />
  </svg>
</template>

<style scoped>
.vl{display:block;flex:none}
.hx{fill:var(--brand);stroke:var(--brand);stroke-width:3;stroke-linejoin:round;transition:fill var(--t-mid) var(--ease-out),stroke var(--t-mid) var(--ease-out)}
.v{fill:none;stroke:#fff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
</style>

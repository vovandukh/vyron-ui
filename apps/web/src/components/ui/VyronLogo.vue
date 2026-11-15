<script setup>
// Знак Vyron (@vyron/shared/logo): контурна V і трикутник-«D» усередині. Колір — фірмовий колір теми
// (--brand), тож логотип змінюється разом із дизайном. На «D» — легкий світлий відблиск у центрі.
import { VIEWBOX, OUTLINE, MARK, OUTLINE_W } from '@vyron/shared/logo'
defineProps({ size: { type: Number, default: 28 } })
const id = 'vlg' + Math.random().toString(36).slice(2, 8)
</script>

<template>
  <svg class="vl" :width="size" :height="size" :viewBox="VIEWBOX" aria-hidden="true">
    <defs>
      <radialGradient :id="id" cx="32" cy="14" r="17" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff" stop-opacity=".55" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </radialGradient>
    </defs>
    <path class="ol" :d="OUTLINE" :stroke-width="OUTLINE_W" />
    <path class="mk" :d="MARK" />
    <path :d="MARK" :fill="`url(#${id})`" fill-rule="evenodd" />
  </svg>
</template>

<style scoped>
.vl{display:block;flex:none;overflow:visible}
.ol{fill:none;stroke:var(--brand);stroke-linejoin:miter;transition:stroke var(--t-mid) var(--ease-out)}
.mk{fill:var(--brand);fill-rule:evenodd;transition:fill var(--t-mid) var(--ease-out)}
</style>

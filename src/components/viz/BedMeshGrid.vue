<script setup>
// Таблиця значень карти столу; передня сторона столу знизу (рядки у зворотному порядку).
import { computed } from 'vue'

const props = defineProps({
  matrix: { type: Array, required: true },
  lim: { type: Number, required: true }
})

const cells = computed(() => props.matrix.slice().reverse().flatMap(r => r.map(v => {
  const t = v / props.lim
  return { v: v.toFixed(3), bg: t < 0 ? `rgba(80,140,255,${-t * 0.8})` : `rgba(240,58,46,${t * 0.8})` }
})))
</script>

<template>
  <div class="mesh" :style="{ gridTemplateColumns: `repeat(${matrix[0].length},1fr)` }">
    <div v-for="(c, i) in cells" :key="i" :style="{ background: c.bg }">{{ c.v }}</div>
  </div>
</template>

<style scoped>
.mesh{display:grid;gap:4px;align-content:start;max-height:100%;overflow:auto;font-size:11px}
.mesh div{padding:8px 2px;min-width:0;text-align:center;border:1px solid var(--line);border-radius:4px;font-weight:200}
@media(max-width:900px){.mesh{max-height:180px}}
</style>

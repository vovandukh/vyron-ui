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
  <div class="mesh" :style="{ gridTemplateColumns: `repeat(${matrix[0].length},1fr)`, '--cols': matrix[0].length }">
    <div v-for="(c, i) in cells" :key="i" :style="{ background: c.bg }">{{ c.v }}</div>
  </div>
</template>

<style scoped>
/* Шрифт підлаштовується під кількість стовпців (container query): сітка 9×9 і більше на 800px
   інакше не влазила і числа обрізались. На широких екранах лишається 11px, як в оригіналі. */
.mesh{display:grid;gap:4px;align-content:start;max-height:100%;overflow:auto;font-size:11px;container-type:inline-size}
.mesh div{padding:8px 2px;min-width:0;overflow:hidden;text-align:center;border:1px solid rgba(255,255,255,.05);border-radius:6px;font-weight:300;
  font-size:clamp(7px,calc((100cqw - (var(--cols) - 1) * 4px) / var(--cols) / 4.2),11px);letter-spacing:-.02em}
@media(max-width:900px){.mesh div{padding:6px 0}}
@media(max-width:700px){.mesh{max-height:180px}}
</style>

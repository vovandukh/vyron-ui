<script setup>
// Шари фону під 3D-сценою (над базовою шестикутною сіткою з main.css):
//  • центральне світіння в кольорі тепла активного екструдера (крижаний ↔ кораловий);
//  • «ліхтарик» гексагонів під курсором — та сама сітка, яскравіша, у масці навколо вказівника;
//  • віньєтка, у якій сітка розчиняється по краях екрана.
// Курсор оновлює лише дві CSS-змінні раз на кадр; на сенсорних екранах (без hover) ліхтарик вимкнено.
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { heatRgb } from '@vyron/shared/format'

const printer = usePrinterStore()
const heat = computed(() => heatRgb(printer.nozzleTemp ?? 25))

const root = document.documentElement
let raf = 0, x = 0, y = 0
const onMove = e => {
  x = e.clientX; y = e.clientY
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    root.style.setProperty('--mx', x + 'px')
    root.style.setProperty('--my', y + 'px')
    root.style.setProperty('--mon', '1')
  })
}
const onLeave = () => root.style.setProperty('--mon', '0')
const hover = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches
onMounted(() => {
  if (!hover) return
  addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerleave', onLeave)
})
onBeforeUnmount(() => {
  removeEventListener('pointermove', onMove)
  document.removeEventListener('pointerleave', onLeave)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="fx" aria-hidden="true" :style="{ '--amb': heat }">
    <div class="amb"></div>
    <div v-if="hover" class="lamp"></div>
    <div class="vig"></div>
  </div>
</template>

<style scoped>
.fx{position:fixed;inset:0;z-index:-1;pointer-events:none}
.fx>div{position:absolute;inset:0}
/* Тепле/холодне світіння за моделлю; колір змінюється разом із температурою сопла */
.amb{opacity:var(--glow-k,1);background:radial-gradient(ellipse 42% 38% at 50% 58%,rgba(var(--amb),.13),rgba(var(--amb),.04) 55%,transparent 75%);transition:background 1.2s var(--ease-out)}
/* Ліхтарик: яскравіша копія гексагонів у кольорі акценту, видима лише в колі навколо курсора.
   Колір — фон шару, а форма — перетин двох масок: сітки гексагонів і кола під курсором. */
.lamp{opacity:calc(var(--mon,0) * min(1, var(--grid-k,1)));transition:opacity .6s var(--ease-out);background:rgba(var(--accent-rgb),.3);
  --hex:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'%3E%3Cpath d='M28 0 56 16.17V48.5L28 64.67 0 48.5V16.17ZM28 64.67V97' fill='none' stroke='%23000' stroke-width='1'/%3E%3C/svg%3E");
  -webkit-mask-image:var(--hex),radial-gradient(circle 190px at var(--mx,50%) var(--my,50%),#000,transparent 100%);
  mask-image:var(--hex),radial-gradient(circle 190px at var(--mx,50%) var(--my,50%),#000,transparent 100%);
  -webkit-mask-size:56px 97px,100% 100%;mask-size:56px 97px,100% 100%;-webkit-mask-repeat:repeat,no-repeat;mask-repeat:repeat,no-repeat;
  -webkit-mask-composite:source-in;mask-composite:intersect}
/* Віньєтка: сітка м'яко тоне в темряві по краях */
.vig{opacity:min(1, var(--glow-k,1));background:radial-gradient(ellipse 90% 85% at 50% 50%,transparent 58%,rgba(5,5,6,.32) 84%,rgba(5,5,6,.6) 100%)}
</style>

<script setup>
// «Керування»: елементи поверх 3D-сцени. Ховаються, коли відкрита будь-яка інша панель.
import { usePrinterStore } from '../../stores/printerStore'
import { useI18n } from '../../composables/useI18n'
import StatusPanel from './control/StatusPanel.vue'
import JogControls from './control/JogControls.vue'
import ToolStrip from './control/ToolStrip.vue'

const printer = usePrinterStore()
const { tm } = useI18n()
</script>

<template>
  <div class="control">
    <StatusPanel />
    <JogControls />
    <div class="pct"><span>{{ printer.progressPct }}</span><small>%</small></div>
    <div class="meta">{{ tm(printer.meta) }}</div>
    <ToolStrip />
  </div>
</template>

<style scoped>
/* Розмір і ширина обмежені відстанню до центрованої смуги голів (~450px для 6 голів), щоб «100%»
   і довга назва файлу не заходили під неї. */
.pct{position:fixed;left:32px;bottom:55px;font-size:clamp(70px,min(16vw,calc((50vw - 270px) / 2)),130px);font-weight:200;line-height:1;letter-spacing:-.04em;pointer-events:none}
.pct small{font-size:.3em;color:var(--red);margin-left:5px}
.meta{position:fixed;left:36px;bottom:24px;color:var(--dim);font-size:12px;pointer-events:none;max-width:min(40vw,calc(50vw - 280px));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* ≤1100px смуга голів піднята над рядком підключення — назва файлу може займати 40vw */
@media(max-width:1100px){.meta{max-width:40vw}}
@media(max-width:900px){.pct{left:16px;bottom:24px;font-size:70px}.meta{display:none}}
@media(max-width:560px){.pct{bottom:12px;font-size:54px}}
</style>

<script setup>
import { usePrinterStore } from '../../../stores/printerStore'
import { useI18n } from '../../../composables/useI18n'

const printer = usePrinterStore()
const { t } = useI18n()

const temp = i => {
  const n = printer.toolObjects[i], v = n ? (printer.st[n] || {}).temperature : null
  return v == null ? '—' : Math.round(v) + '°'
}
</script>

<template>
  <div class="tools">
    <button v-for="i in 6" :key="i" class="tool"
            :class="{ active: i - 1 === printer.activeTool, missing: !printer.toolObjects[i - 1] }"
            :title="printer.toolObjects[i - 1] || t('tools.notFoundTitle')"
            :disabled="!printer.toolObjects[i - 1] || printer.demoMode"
            @click="printer.selectTool(i - 1)">
      <b>T{{ i - 1 }}</b><small>{{ temp(i - 1) }}</small>
    </button>
  </div>
</template>

<style scoped>
.tools{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;display:flex;gap:7px;z-index:4;padding:7px;background:rgba(10,10,11,.88);border:1px solid var(--line);border-radius:10px;backdrop-filter:blur(12px)}
.tool{min-width:66px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--dim);padding:7px 9px;cursor:pointer;font:inherit;text-align:center}
.tool b{display:block;color:var(--ink);font-size:12px;font-weight:500}
.tool small{display:block;margin-top:3px;font-size:10px}
.tool.active{border-color:rgba(240,58,46,.7);background:rgba(240,58,46,.10);color:var(--red)}
.tool.active b{color:var(--ink)}
.tool.missing{opacity:.35}
/* ≤1100px (екран принтера 1024×600) смуга і рядок підключення не вміщаються в один ряд — піднімаємо смугу */
@media(max-width:1100px){.tools{bottom:62px}}
@media(max-width:900px){.tools{max-width:94vw;overflow:auto}.tool{min-width:52px;padding:6px}}
@media(max-width:560px){.tools{bottom:55px}}
</style>

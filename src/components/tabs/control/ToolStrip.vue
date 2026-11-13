<script setup>
// Смуга голів: рівно стільки кнопок, скільки екструдерів знайдено в Klipper (1…N).
import { usePrinterStore } from '../../../stores/printerStore'
import { toolNum } from '../../../services/klipper'

const printer = usePrinterStore()

const temp = name => {
  const v = (printer.st[name] || {}).temperature
  return v == null ? '—' : Math.round(v) + '°'
}
</script>

<template>
  <div v-if="printer.toolObjects.length" class="tools">
    <button v-for="(name, i) in printer.toolObjects" :key="name" class="tool"
            :class="{ active: name === printer.activeToolName, single: !printer.canSwitchTools }"
            :title="name"
            :disabled="!printer.canSwitchTools || printer.demoMode"
            @click="printer.selectTool(i)">
      <b>T{{ toolNum(name) }}</b><small>{{ temp(name) }}</small>
    </button>
  </div>
</template>

<style scoped>
.tools{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;display:flex;gap:7px;z-index:4;padding:7px;max-width:94vw;overflow-x:auto;background:rgba(10,10,11,.88);border:1px solid var(--line);border-radius:10px;backdrop-filter:blur(12px)}
.tool{flex:none;min-width:66px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--dim);padding:7px 9px;cursor:pointer;font:inherit;text-align:center}
.tool b{display:block;color:var(--ink);font-size:12px;font-weight:500}
.tool small{display:block;margin-top:3px;font-size:10px}
.tool.active{border-color:rgba(240,58,46,.7);background:rgba(240,58,46,.10);color:var(--red)}
.tool.active b{color:var(--ink)}
/* Одна голова: перемикати нічого, кнопка лише показує температуру (без «вимкненого» вигляду) */
.tool.single{cursor:default}
.tool:disabled:not(.single):not(.active){opacity:.6;cursor:default}
/* ≤1100px (екран принтера 1024×600) смуга і рядок підключення не вміщаються в один ряд — піднімаємо смугу */
@media(max-width:1100px){.tools{bottom:62px}}
@media(max-width:900px){.tool{min-width:52px;padding:6px}}
</style>

<script setup>
import { computed } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useUiStore } from '../../../stores/uiStore'
import { useI18n } from '../../../composables/useI18n'
import { fmtTemp, fmtPct } from '../../../utils/format'

const printer = usePrinterStore()
const ui = useUiStore()
const { t } = useI18n()

const rows = computed(() => {
  const pos = printer.position, q = printer.qgl
  return [
    { key: 'status.nozzle', val: fmtTemp(printer.nozzleTemp), heater: 'nozzle', aria: 'status.setNozzle' },
    { key: 'status.bed', val: fmtTemp(printer.bedTemp), heater: 'bed', aria: 'status.setBed' },
    { key: 'status.chamber', val: fmtTemp(printer.chamberTemp) },
    { key: 'status.speed', val: fmtPct(printer.speedFactor) },
    { key: 'status.fan', val: fmtPct(printer.fanSpeed) },
    { key: 'status.z', val: pos ? t('unit.mm', { v: Number(pos[2]).toFixed(1) }) : '–' },
    { key: 'status.layer', val: printer.layerText },
    { key: 'status.qgl', val: q == null ? '–' : t(q ? 'status.qglDone' : 'status.qglNot') }
  ]
})
</script>

<template>
  <dl class="st">
    <template v-for="r in rows" :key="r.key">
      <div v-if="r.heater" class="tt" role="button" tabindex="0" :aria-label="t(r.aria)"
           @click="ui.tempModal = r.heater" @keydown.enter.space.prevent="ui.tempModal = r.heater">
        <dt>{{ t(r.key) }}</dt><dd>{{ r.val }}</dd>
      </div>
      <div v-else><dt>{{ t(r.key) }}</dt><dd>{{ r.val }}</dd></div>
    </template>
  </dl>
</template>

<style scoped>
.st{position:fixed;top:calc(var(--hb,72px) + 16px);right:36px;display:grid;gap:0;width:min(250px,40vw);margin:0;padding:6px 14px;text-align:left;pointer-events:none;background:rgba(10,10,11,.6);border:1px solid var(--line);border-radius:10px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.st>div{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 -6px;padding:9px 6px;border-bottom:1px solid var(--line);border-radius:0}
.st>div:last-child{border-bottom:0}
dt{font-size:12px;color:var(--dim)}
dd{margin:0;font-size:16px;font-weight:300;white-space:nowrap}
.st .tt{pointer-events:auto;cursor:pointer;border-radius:8px}
.st .tt:hover{background:rgba(255,255,255,.05)}
.st .tt:focus-visible{outline:2px solid var(--red);outline-offset:2px}
@media(max-width:700px){.st{top:auto;bottom:140px;right:14px;width:min(240px,62vw)}}
@media(max-width:560px){.st>div{min-width:65px}}
/* Низькі екрани (800×480): компактні рядки, щоб блок не заходив під смугу голів */
@media(max-height:540px){.st{padding:4px 12px}.st>div,.st .tt{padding:5px 6px}dd{font-size:14px}dt{font-size:11px}}
</style>

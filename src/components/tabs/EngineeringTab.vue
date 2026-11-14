<script setup>
// «Інженерне меню» → «Діагностика та система»: стан Klipper/хоста + картка заліза (хост і всі MCU).
// Опитування machine.proc_stats іде лише поки підрозділ видно (active).
import { computed, reactive, watch, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'
import { fmtDuration } from '../../utils/format'
import { demoSysInfo } from '../../services/demo'
import HardwareCard from './eng/HardwareCard.vue'

const props = defineProps({ active: { type: Boolean, default: false } })

const POLL_MS = 7000
const printer = usePrinterStore()
const { ask } = useConfirm()
const { t } = useI18n()

const s = reactive({ sver: null, shost: null, sstate: null, cpu: null, cpuTemp: null, memPct: null, uptime: null, uptimeKey: null })

/** Лише рядки з даними — без прочерків */
const rows = computed(() => [
  ['eng.klipper', s.sver],
  ['eng.host', s.shost],
  ['eng.state', s.sstate],
  ['eng.uptime', s.uptimeKey ? t(s.uptimeKey) : s.uptime == null ? null : fmtDuration(s.uptime, t)]
].filter(([, v]) => v != null && v !== ''))

function load() {
  if (printer.demoMode) { Object.assign(s, demoSysInfo); return }
  if (!printer.connected) return
  printer.call('printer.info', {}).then(i => {
    Object.assign(s, { sver: i.software_version || null, shost: i.hostname || null, sstate: i.state || null })
  }).catch(() => {})
  printer.call('machine.proc_stats', {}).then(p => {
    const m = p.system_memory || {}
    Object.assign(s, {
      cpu: p.system_cpu_usage ? p.system_cpu_usage.cpu : null,
      cpuTemp: p.cpu_temp != null ? p.cpu_temp : null,
      memPct: m.total ? (m.used / m.total) * 100 : null,
      uptime: p.system_uptime || null, uptimeKey: null
    })
  }).catch(() => {})
}

let timer = null
const stop = () => { clearInterval(timer); timer = null }
watch(() => props.active, a => { stop(); if (a) { load(); timer = setInterval(load, POLL_MS) } }, { immediate: true })
// Демо ↔ реальний принтер — перечитати
watch(() => [printer.demoMode, printer.link], () => { if (props.active) load() })
onBeforeUnmount(stop)

async function restart(fw) {
  if (!(await ask(fw ? 'eng.confirmFw' : 'eng.confirmRestart'))) return
  printer.call(fw ? 'printer.firmware_restart' : 'printer.restart', {}).catch(() => {})
}
</script>

<template>
  <div class="eng">
    <div class="card sys">
      <h3>{{ t('eng.system') }}</h3>
      <dl v-if="rows.length"><div v-for="[k, v] in rows" :key="k"><dt>{{ t(k) }}</dt><dd :class="{ mono: k === 'eng.klipper' }" :title="v">{{ v }}</dd></div></dl>
      <div class="btns">
        <button :disabled="printer.isPrinting" @click="restart(false)">Restart Klipper</button>
        <button :disabled="printer.isPrinting" @click="restart(true)">Firmware restart</button>
      </div>
    </div>
    <HardwareCard :proc-cpu="s.cpu" :proc-temp="s.cpuTemp" :proc-mem-pct="s.memPct" />
  </div>
</template>

<style scoped>
/* Дві колонки на широких екранах, одна — на 800×480 */
.eng{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:14px;align-items:start}
.sys{display:grid;gap:14px}
h3{margin:0;font-size:12px;font-weight:500;color:var(--dim);letter-spacing:.04em;text-transform:uppercase}
.sys dl{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px}
.sys dt{font-size:11px;color:var(--dim)}
.sys dd{margin:2px 0 0;font-size:17px;font-weight:300;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sys dd.mono{font:400 13px/1.6 var(--mono)}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media(max-width:900px){.eng{grid-template-columns:minmax(0,1fr)}}
@media(max-width:560px){.btns{grid-template-columns:1fr}}
</style>

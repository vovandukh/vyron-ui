<script setup>
import { computed, reactive, onActivated, onDeactivated } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'
import { fmtDuration } from '../../utils/format'
import { demoSysInfo } from '../../services/demo'

const POLL_MS = 7000
const printer = usePrinterStore()
const { ask } = useConfirm()
const { t } = useI18n()

const s = reactive({ sver: null, shost: null, sstate: null, cpu: null, cpuTemp: null, memPct: null, memGb: null, uptime: null, uptimeKey: null })

const rows = computed(() => [
  ['eng.klipper', s.sver ?? '–'],
  ['eng.host', s.shost ?? '–'],
  ['eng.state', s.sstate ?? '–'],
  ['eng.cpu', s.cpu == null ? '–' : s.cpu + '%'],
  ['eng.cpuTemp', s.cpuTemp == null ? '–' : s.cpuTemp + '°'],
  ['eng.mem', s.memPct == null ? '–' : t('eng.memVal', { p: s.memPct, gb: s.memGb })],
  ['eng.uptime', s.uptimeKey ? t(s.uptimeKey) : s.uptime == null ? '–' : fmtDuration(s.uptime, t)]
])

function load() {
  if (printer.demoMode) { Object.assign(s, demoSysInfo); return }
  printer.call('printer.info', {}).then(i => {
    Object.assign(s, { sver: i.software_version || '–', shost: i.hostname || '–', sstate: i.state || '–' })
  }).catch(() => {})
  printer.call('machine.proc_stats', {}).then(p => {
    const m = p.system_memory || {}
    Object.assign(s, {
      cpu: p.system_cpu_usage ? Math.round(p.system_cpu_usage.cpu) : null,
      cpuTemp: p.cpu_temp != null ? Math.round(p.cpu_temp) : null,
      memPct: m.total ? Math.round((m.used / m.total) * 100) : null,
      memGb: m.total ? (m.total / 1048576).toFixed(1) : null,
      uptime: p.system_uptime || null, uptimeKey: null
    })
  }).catch(() => {})
}

let timer = null
onActivated(() => { load(); timer = setInterval(load, POLL_MS) })
onDeactivated(() => clearInterval(timer))

async function restart(fw) {
  if (!(await ask(fw ? 'eng.confirmFw' : 'eng.confirmRestart'))) return
  printer.call(fw ? 'printer.firmware_restart' : 'printer.restart', {}).catch(() => {})
}
</script>

<template>
  <section class="view">
    <div class="eng">
      <div class="sys">
        <dl><div v-for="[k, v] in rows" :key="k"><dt>{{ t(k) }}</dt><dd>{{ v }}</dd></div></dl>
        <div class="btns">
          <button :disabled="printer.isPrinting" @click="restart(false)">Restart Klipper</button>
          <button :disabled="printer.isPrinting" @click="restart(true)">Firmware restart</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.eng{display:grid;grid-template-columns:minmax(0,560px);gap:20px;flex:1;min-height:0}
.sys{background:var(--surface);border:1px solid var(--hair);border-radius:var(--r-lg);padding:16px}
.sys dl{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px}
.sys dt{font-size:11px;color:var(--dim)}
.sys dd{margin:2px 0 0;font-size:18px;font-weight:300}
.btns{display:grid;gap:7px;margin-top:16px}

</style>

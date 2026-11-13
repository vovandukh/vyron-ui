<script setup>
// Компактний блок датчика BTT Eddy у меню голови: підключення, ID, температура котушки,
// тип/частота, температура чипа MCU, стан CAN-шини, температурна компенсація.
import { computed } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useI18n } from '../../../composables/useI18n'
import { shortId } from '../../../services/toolheads'

const props = defineProps({ eddy: { type: Object, required: true } })

const printer = usePrinterStore()
const { t } = useI18n()

const obj = name => (name ? printer.st[name] || {} : {})
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const deg = v => (v == null ? '–' : v.toFixed(1) + '°')

const coil = computed(() => num(obj(props.eddy.tempProbeObj).temperature))
const chip = computed(() => num(obj(props.eddy.chipObj).temperature))
const comp = computed(() => obj(props.eddy.tempProbeObj).compensation_enabled)

const badge = computed(() => ({ can: 'CAN', usb: 'USB', shared: t('eddy.shared'), main: 'MCU' })[props.eddy.link])
const id = computed(() => {
  const e = props.eddy
  if (e.link === 'shared') return { short: e.mcu, title: t('eddy.onBoard', { mcu: e.mcu }) }
  if (e.canbusUuid) return { short: shortId(e.canbusUuid), title: t('tools.can.uuidTitle', { id: e.canbusUuid, iface: e.canbusInterface || '–' }) }
  if (e.serial) return { short: e.serial.split('/').pop().replace(/^usb-Klipper_/, '').slice(0, 14) + '…', title: t('tools.can.serialTitle', { id: e.serial }) }
  return null
})

const sensor = computed(() => {
  const e = props.eddy
  const type = e.sensorType ? e.sensorType.toUpperCase() : null
  const mhz = e.frequency ? Math.round(e.frequency / 1e5) / 10 + ' ' + t('tools.can.mhz') : null
  return [type, mhz].filter(Boolean).join(' · ')
})

/** Стан зв'язку: CAN — за canbus_stats.bus_state, інакше — чи відповідає MCU. Для «shared» стан показує блок плати голови. */
const status = computed(() => {
  const e = props.eddy
  if (e.link === 'shared' || e.link === 'main') return null
  const bus = obj(e.canStatsObj).bus_state
  if (bus) return bus === 'active' ? { text: t('eddy.busActive'), ok: true } : { text: t('eddy.busState', { s: bus }), ok: false }
  return obj(e.mcuObj).mcu_version ? { text: t('eddy.online'), ok: true } : { text: t('tools.can.noData'), ok: false }
})
</script>

<template>
  <div class="ed">
    <div class="edh">
      <span class="badge">EDDY</span>
      <b class="name" :title="eddy.probeObj">{{ eddy.name }}</b>
      <span class="link" :class="eddy.link">{{ badge }}</span>
      <span v-if="id" class="id" :title="id.title">{{ id.short }}</span>
      <span class="sp"></span>
      <span class="temp" :title="t('eddy.coil')">{{ deg(coil) }}</span>
    </div>
    <div class="row2">
      <span v-if="sensor">{{ sensor }}</span>
      <span v-if="chip != null" :title="t('eddy.chip')">MCU <i>{{ deg(chip) }}</i></span>
      <span v-if="status" :class="{ bad: !status.ok }">{{ status.text }}</span>
      <span v-if="comp != null">{{ t('eddy.comp') }} <i>{{ t(comp ? 'eddy.on' : 'eddy.off') }}</i></span>
    </div>
  </div>
</template>

<style scoped>
.ed{border:1px solid var(--line);border-radius:7px;padding:8px 10px;display:grid;gap:5px;background:rgba(255,255,255,.02);font-size:11px;color:var(--dim);min-width:0}
.edh{display:flex;align-items:center;gap:7px;min-width:0}
.badge{flex:none;font-size:9px;font-weight:600;letter-spacing:.08em;padding:2px 5px;border-radius:4px;border:1px solid rgba(120,156,255,.6);color:var(--blue)}
.name{color:var(--ink);font-weight:500;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.link{flex:none;font-size:9px;letter-spacing:.06em;padding:1px 4px;border-radius:4px;border:1px solid var(--line)}
.link.can{border-color:rgba(240,58,46,.6);color:var(--red)}
.id{font-family:var(--mono);font-size:10px;white-space:nowrap;cursor:help;overflow:hidden;text-overflow:ellipsis;min-width:0}
.sp{flex:1}
.temp{flex:none;color:var(--ink);font-size:14px;font-weight:300;cursor:help}
.row2{display:flex;flex-wrap:wrap;gap:3px 10px}
.row2 span{white-space:nowrap}
.row2 i{font-style:normal;color:var(--ink)}
.bad{color:var(--red)}
</style>

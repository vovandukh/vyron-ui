<script setup>
// Компактний блок плати голови (CAN / USB toolboard): назва MCU, температура, ID, версія,
// навантаження, вентилятори та драйвер. Показується лише якщо голова на окремому MCU.
import { computed } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useI18n } from '../../../composables/useI18n'
import { shortId, mcuLoad, boardSensor } from '../../../services/toolheads'

const props = defineProps({ th: { type: Object, required: true } })
const BOARD_HOT = 75

const printer = usePrinterStore()
const { t } = useI18n()

const obj = name => (name ? printer.st[name] || {} : {})
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const mcu = computed(() => obj(props.th.mcuObj))
const board = computed(() => {
  const s = boardSensor(props.th)
  return s ? { name: s.name, temp: num(obj(s.obj).temperature) } : null
})
const extraSensors = computed(() => {
  const b = boardSensor(props.th)
  return props.th.sensors.filter(s => s !== b).map(s => ({ name: s.name, temp: num(obj(s.obj).temperature) }))
})

const id = computed(() => {
  const th = props.th
  if (th.canbusUuid) return { short: shortId(th.canbusUuid), title: t('tools.can.uuidTitle', { id: th.canbusUuid, iface: th.canbusInterface || '–' }) }
  if (th.serial) return { short: th.serial.split('/').pop().replace(/^usb-Klipper_/, '').slice(0, 14) + '…', title: t('tools.can.serialTitle', { id: th.serial }) }
  return null
})

const version = computed(() => {
  const v = mcu.value.mcu_version
  return v ? { short: v.replace(/-g[0-9a-f]+(-dirty)?$/, ''), full: v } : null
})
const load = computed(() => {
  const l = mcuLoad(mcu.value.last_stats)
  return l == null ? null : Math.round(l * 100)
})
const mhz = computed(() => {
  const f = num((mcu.value.last_stats || {}).freq)
  return f ? Math.round(f / 1e6) : null
})
const online = computed(() => !!mcu.value.mcu_version)

const FAN_LABEL = { hotend: 'tools.can.fanHotend', part: 'tools.can.fanPart', generic: 'tools.can.fanGeneric', controller: 'tools.can.fanController' }
const fans = computed(() => props.th.fans.map(f => {
  const o = obj(f.obj), sp = num(o.speed), rpm = num(o.rpm)
  return { key: f.obj, label: t(FAN_LABEL[f.kind]), title: f.name, val: sp == null ? '–' : Math.round(sp * 100) + '%', rpm: rpm ? t('tools.can.rpm', { v: Math.round(rpm) }) : '' }
}))
const drivers = computed(() => props.th.drivers
  .map(d => ({ name: d.name, temp: num(obj(d.obj).temperature) }))
  .filter(d => d.temp != null))

const deg = v => (v == null ? '–' : v.toFixed(1) + '°')
</script>

<template>
  <div class="tb">
    <div class="tbh">
      <span class="badge" :class="th.link">{{ th.link === 'can' ? 'CAN' : th.link === 'usb' ? 'USB' : 'MCU' }}</span>
      <b class="name" :title="th.mcuObj">{{ th.mcu }}</b>
      <span v-if="id" class="id" :title="id.title">{{ id.short }}</span>
      <span class="sp"></span>
      <span v-if="board" class="temp" :class="{ hot: board.temp != null && board.temp >= BOARD_HOT }" :title="t('tools.can.boardTemp', { name: board.name })">{{ deg(board.temp) }}</span>
    </div>
    <!-- .ver: прошивка/навантаження; на низьких екранах ховається, якщо MCU на зв'язку (див. ToolPopover) -->
    <div class="row2" :class="{ ver: online }">
      <span v-if="!online" class="off">{{ t('tools.can.noData') }}</span>
      <template v-else>
        <span v-if="version" :title="t('tools.can.versionTitle', { v: version.full })">Klipper {{ version.short }}</span>
        <span v-if="load != null">{{ t('tools.can.load', { v: load }) }}</span>
        <span v-if="mhz">{{ mhz }} {{ t('tools.can.mhz') }}</span>
      </template>
    </div>
    <div v-if="fans.length || drivers.length || extraSensors.length" class="row2">
      <span v-for="f in fans" :key="f.key" :title="f.title + (f.rpm ? ' · ' + f.rpm : '')">{{ f.label }} <i>{{ f.val }}</i></span>
      <span v-for="d in drivers" :key="d.name">{{ d.name }} <i>{{ deg(d.temp) }}</i></span>
      <span v-for="s in extraSensors" :key="s.name">{{ s.name }} <i>{{ deg(s.temp) }}</i></span>
    </div>
  </div>
</template>

<style scoped>
.tb{border:1px solid var(--hair);border-radius:var(--r-md);padding:8px 10px;display:grid;gap:5px;background:var(--surface);font-size:11px;color:var(--dim);min-width:0}
.tbh{display:flex;align-items:center;gap:7px;min-width:0}
.badge{flex:none;font-size:9px;font-weight:600;letter-spacing:.08em;padding:2px 6px;border-radius:999px;border:1px solid rgba(240,58,46,.6);color:var(--red)}
.badge.usb{border-color:rgba(120,156,255,.6);color:var(--blue)}
.badge.mcu{border-color:var(--line);color:var(--dim)}
.name{color:var(--ink);font-weight:500;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.id{font-family:var(--mono);font-size:10px;white-space:nowrap;cursor:help}
.sp{flex:1}
.temp{flex:none;color:var(--ink);font-size:14px;font-weight:300;cursor:help}
.temp.hot{color:var(--red)}
.row2{display:flex;flex-wrap:wrap;gap:3px 10px}
.row2 span{white-space:nowrap}
.row2 i{font-style:normal;color:var(--ink)}
.off{color:var(--red)}
</style>

<script setup>
// «Апаратне забезпечення та MCU»: хост (модель, CPU, RAM, навантаження, температура) і всі мікроконтролери
// з printer.objects.list (версія прошивки, чип, частота, стабільність зв'язку, температура чипа).
// Показується лише те, що реально є в конфігурації й має дані — без прочерків.
// Індикатор шини: зелений, поки bytes_retransmit / bytes_invalid не ростуть; бурштиновий — 30 с після зростання.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useI18n } from '../../../composables/useI18n'
import { mcuName } from '@vyron/shared/klipper/objects'
import RollNumber from '../../ui/RollNumber.vue'
import McuCard from './McuCard.vue'
import { useUiStore } from '../../../stores/uiStore'

const props = defineProps({
  /** Запасні дані з machine.proc_stats, якщо немає system_stats / датчика хоста */
  procCpu: { type: Number, default: null },
  procTemp: { type: Number, default: null },
  procMemPct: { type: Number, default: null }
})

const printer = usePrinterStore()
const ui = useUiStore()
const { t } = useI18n()
const num = v => (v == null || !Number.isFinite(Number(v)) ? null : Number(v))
const tempOf = obj => num((printer.st[obj] || {}).temperature)

// ---------- хост ----------
const host = computed(() => {
  const ci = (printer.hostInfo || {}).cpu_info || {}
  const ss = printer.st.system_stats || {}
  const cores = num(ci.cpu_count)
  const totalKb = num(ci.total_memory) // memory_units: kB
  const sensor = printer.hwSensors.find(s => s.type === 'host')
  // CPU: реальне завантаження з proc_stats; інакше sysload (середнє навантаження) / ядра
  let cpu = props.procCpu
  if (cpu == null && num(ss.sysload) != null && cores) cpu = Math.min(100, (ss.sysload / cores) * 100)
  let mem = null
  if (totalKb && num(ss.memavail) != null) mem = Math.min(100, Math.max(0, ((totalKb - ss.memavail) / totalKb) * 100))
  else mem = props.procMemPct
  // Назва плати хоста: model (Raspberry Pi) → образ ОС (Armbian на CB1: «# BIGTREETECH-CB1») → опис заліза
  const dist = (printer.hostInfo || {}).distribution || {}
  const board = String((dist.release_info || {}).name || '').replace(/^#\s*/, '').trim()
  const cpuDesc = ci.cpu_desc || [ci.processor, ci.bits].filter(Boolean).join(' ')
  const out = {
    model: ci.model || board || ci.hardware_desc || dist.name || ci.processor || null,
    sub: [cpuDesc, cores ? t('hw.cores', { n: cores }) : null, totalKb ? t('hw.ram', { gb: (totalKb / 1048576).toFixed(1) }) : null, dist.name].filter(Boolean).join(' · '),
    metrics: []
  }
  if (cpu != null) out.metrics.push({ id: 'cpu', label: t('hw.cpuLoad'), value: cpu, suffix: '%', level: cpu / 100 })
  if (mem != null) out.metrics.push({ id: 'ram', label: t('hw.ramUsed'), value: mem, suffix: '%', level: mem / 100 })
  const tt = sensor ? tempOf(sensor.obj) : props.procTemp
  if (tt != null) out.metrics.push({ id: 'temp', label: t('hw.hostTemp'), value: tt, suffix: '°', level: (tt - 30) / 55, temp: true })
  if (num(ss.sysload) != null) out.metrics.push({ id: 'load', label: t('hw.sysload'), value: ss.sysload, decimals: 2 })
  return out.model || out.metrics.length ? out : null
})

// ---------- MCU: акордеон, одночасно розгорнута одна картка (стан — ui.hwOpen, за замовчуванням основна плата) ----------
const mcus = computed(() => printer.mcuObjects.filter(obj => {
  const m = printer.st[obj]
  return m && (m.mcu_version || m.last_stats)
}))
const toggle = obj => { ui.hwOpen = ui.hwOpen === obj ? null : obj }

// Стабільність шини: зростання втрат відстежує стор (printer.mcuBadAt) від самого підключення;
// CAN-шина не в стані active — теж попередження
const WARN_MS = 30000
const now = ref(Date.now())
function health(obj) {
  const m = printer.st[obj] || {}
  if (!m.mcu_version) return 'off'
  const bus = (printer.st['canbus_stats ' + mcuName(obj)] || {}).bus_state
  if (bus && bus !== 'active') return 'warn'
  return now.value - (printer.mcuBadAt[obj] || 0) < WARN_MS ? 'warn' : 'ok'
}
let clock = 0
onMounted(() => { clock = setInterval(() => { now.value = Date.now() }, 5000) })
onBeforeUnmount(() => clearInterval(clock))

const lvl = x => Math.min(1, Math.max(0, x ?? 0))
</script>

<template>
  <div v-if="host || mcus.length" class="card hw">
    <h3>{{ t('hw.title') }}</h3>

    <!-- Хост -->
    <div v-if="host" class="host">
      <div class="hd">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 1.5V4M15 1.5V4M9 20v2.5M15 20v2.5M1.5 9H4M1.5 15H4M20 9h2.5M20 15h2.5" /></svg>
        <div class="nm">
          <b>{{ host.model || t('hw.host') }}</b>
          <small v-if="host.sub">{{ host.sub }}</small>
        </div>
      </div>
      <div v-if="host.metrics.length" class="mets">
        <div v-for="m in host.metrics" :key="m.id" class="met" :class="{ hot: m.temp && m.value >= 70 }">
          <small>{{ m.label }}</small>
          <b><RollNumber :value="m.value" :decimals="m.decimals || 0" :suffix="m.suffix || ''" /></b>
          <i v-if="m.level != null" class="bar"><i :style="{ transform: `scaleX(${lvl(m.level)})` }" :class="{ high: lvl(m.level) > 0.8 }"></i></i>
        </div>
      </div>
    </div>

    <!-- Мікроконтролери: акордеон -->
    <ul v-if="mcus.length" class="mcus">
      <McuCard v-for="obj in mcus" :key="obj" :obj="obj" :open="ui.hwOpen === obj" :health="health(obj)" @toggle="toggle(obj)" />
    </ul>
  </div>
</template>

<style scoped>
.hw{display:grid;gap:14px;align-content:start}
h3{margin:0;font-size:12px;font-weight:500;color:var(--dim);letter-spacing:.04em;text-transform:uppercase}
.host{display:grid;gap:12px}
.hd{display:flex;align-items:center;gap:12px}
.ic{flex:none;width:34px;height:34px;padding:7px;border-radius:10px;background:rgba(124,199,255,.1);fill:none;stroke:var(--ice);stroke-width:1.5;stroke-linecap:round}
.nm{display:grid;gap:2px;min-width:0}
.nm b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm small{color:var(--dim);font-size:11px}
/* Метрики хоста: великі цифри-одометри зі смужкою рівня */
.mets{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.met{display:grid;gap:4px;align-content:start;padding:10px 12px;border-radius:var(--r-md);background:rgba(0,0,0,.22);border:1px solid var(--hair)}
/* Підпис в один рядок — цифри в сусідніх плитках стоять на одній лінії */
.met small{font-size:10px;color:var(--dim);letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.met b{font-size:20px;font-weight:300;line-height:1.1}
.met.hot b{color:var(--coral)}
.bar{display:block;height:3px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden}
.bar i{display:block;height:100%;background:var(--ice);transform-origin:left;transition:transform var(--t-spring) var(--spring),background-color var(--t-mid) var(--ease-out)}
.bar i.high{background:#ffb35c}
/* MCU */
.mcus{list-style:none;margin:0;padding:0;display:grid;gap:6px}
</style>

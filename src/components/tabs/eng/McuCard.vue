<script setup>
// Картка мікроконтролера-акордеон. Згорнута: індикатор шини, назва, чип, температура, шеврон.
// Розгорнута: повна діагностика з last_stats (Klipper) + підключення з printer.cfg + CAN-статистика.
// Висота анімується через grid-template-rows 0fr → 1fr на пружині — без вимірювань у JS і без «стрибків».
import { computed } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useI18n } from '../../../composables/useI18n'
import { mcuName } from '../../../services/klipper'
import { mcuLoad } from '../../../services/toolheads'
import RollNumber from '../../ui/RollNumber.vue'

const props = defineProps({
  obj: { type: String, required: true },
  open: { type: Boolean, default: false },
  /** 'ok' | 'warn' | 'off' — рахує батьківська картка (спільний годинник) */
  health: { type: String, default: 'ok' }
})
defineEmits(['toggle'])

const printer = usePrinterStore()
const { t } = useI18n()
const num = v => (v == null || !Number.isFinite(Number(v)) ? null : Number(v))

const m = computed(() => printer.st[props.obj] || {})
const ls = computed(() => m.value.last_stats || {})
const name = computed(() => mcuName(props.obj))
const chip = computed(() => (m.value.mcu_constants || {}).MCU || null)
const isLinux = computed(() => chip.value === 'linux')
const title = computed(() => (props.obj === 'mcu' ? t('hw.mainBoard') : props.obj === 'mcu host' ? t('hw.hostMcu') : name.value))

/** Температура: чип (temperature_mcu) → термістор плати → для host-MCU — датчик хоста */
const temp = computed(() => {
  const lc = name.value.toLowerCase(), S = printer.hwSensors
  const s = S.find(x => x.type === 'mcu' && String(x.mcu).toLowerCase() === lc)
    || S.find(x => x.type === 'board' && String(x.mcu).toLowerCase() === lc)
    || (isLinux.value ? S.find(x => x.type === 'host') : null)
  const v = s ? num((printer.st[s.obj] || {}).temperature) : null
  return v == null ? null : { v, kind: s.type, name: s.name }
})

const conn = computed(() => printer.mcuConn[props.obj] || null)
const can = computed(() => printer.st['canbus_stats ' + name.value] || null)

const fmtBytes = b => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? (b / 1024).toFixed(1) + ' KB' : Math.round(b) + ' B')
const fmtRate = b => (b >= 1024 ? (b / 1024).toFixed(1) + ' KB/s' : Math.round(b) + ' B/s')

/** Плитки діагностики — лише ті, для яких є дані */
const tiles = computed(() => {
  const s = ls.value, c = m.value.mcu_constants || {}, out = []
  const gcc = /gcc:\s*\([^)]*\)\s*([\d.]+)/.exec(m.value.mcu_build_versions || '')
  if (m.value.mcu_version) out.push({ id: 'ver', label: t('hw.firmware'), text: m.value.mcu_version, sub: gcc ? 'gcc ' + gcc[1] : null, mono: true, wide: true })
  if (conn.value) {
    const k = conn.value.kind
    const head = k === 'can' ? 'CAN · ' + conn.value.iface : k === 'usb' ? 'USB' : k === 'linux' ? t('hw.linuxProc') : 'UART' + (conn.value.baud ? ' · ' + conn.value.baud : '')
    out.push({ id: 'conn', label: t('hw.link'), text: head, sub: conn.value.id, mono: true, wide: true, subMono: true })
  }
  const clk = num(c.CLOCK_FREQ) ?? num(s.freq)
  if (clk) out.push({ id: 'clk', label: t('hw.clock'), value: clk / 1e6, decimals: clk >= 1e8 ? 0 : 1, suffix: ' ' + t('hw.mhz') })
  const load = mcuLoad(s)
  if (load != null) out.push({ id: 'load', label: t('hw.mcuLoad'), value: load * 100, decimals: 1, suffix: '%' })
  if (num(s.mcu_awake) != null) out.push({ id: 'awake', label: 'Awake', value: (s.mcu_awake / 5) * 100, decimals: 2, suffix: '%' })
  if (num(s.srtt) != null) out.push({ id: 'rtt', label: t('hw.latency'), value: s.srtt * 1000, decimals: 1, suffix: ' ms', sub: num(s.rttvar) != null ? '± ' + (s.rttvar * 1000).toFixed(1) + ' ms' : null })
  const rate = printer.mcuRate[props.obj]
  // Вихідний / вхідний — двома рядками, щоб не обрізались у вузькій плитці
  if (rate) out.push({ id: 'bw', label: t('hw.bandwidth'), text: '↑ ' + fmtRate(rate.w), sub: '↓ ' + fmtRate(rate.r) })
  if (num(s.bytes_write) != null && num(s.bytes_read) != null) out.push({ id: 'tot', label: t('hw.transferred'), text: '↑ ' + fmtBytes(s.bytes_write), sub: '↓ ' + fmtBytes(s.bytes_read) })
  if (num(s.bytes_retransmit) != null) out.push({ id: 'retr', label: 'Retransmits', value: s.bytes_retransmit, warn: props.health === 'warn' })
  if (num(s.bytes_invalid) != null) out.push({ id: 'inv', label: 'Invalid', value: s.bytes_invalid, warn: s.bytes_invalid > 0 })
  if (can.value) {
    const b = can.value
    if (b.bus_state) out.push({ id: 'bus', label: t('hw.canBus'), text: b.bus_state, warn: b.bus_state !== 'active', ok: b.bus_state === 'active' })
    if (num(b.tx_retries) != null) out.push({ id: 'txr', label: 'TX retries', value: b.tx_retries })
    if (num(b.rx_error) != null || num(b.tx_error) != null) out.push({ id: 'err', label: 'RX / TX errors', text: (b.rx_error ?? 0) + ' / ' + (b.tx_error ?? 0), warn: (b.rx_error || 0) + (b.tx_error || 0) > 0 })
  }
  if (temp.value) out.push({ id: 'temp', label: t('hw.temp.' + temp.value.kind), value: temp.value.v, suffix: '°', sub: temp.value.name })
  return out
})
</script>

<template>
  <li class="mc" :class="{ open, ['h-' + health]: true }">
    <button type="button" class="mhead" :aria-expanded="String(open)" :aria-controls="'mcb-' + obj.replace(/\s/g, '_')" @click="$emit('toggle')">
      <span class="dot" :title="t('hw.bus.' + health)"></span>
      <b class="mt">{{ title }}</b>
      <span v-if="chip" class="chip">{{ chip }}</span>
      <span class="sp"></span>
      <b v-if="temp" class="mtemp"><RollNumber :value="temp.v" suffix="°" /></b>
      <svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
    </button>
    <!-- Тіло: grid 0fr ↔ 1fr — плавна зміна висоти без вимірювань -->
    <div :id="'mcb-' + obj.replace(/\s/g, '_')" class="mbody" :inert="!open || null">
      <div class="mclip">
        <div class="tiles">
          <div v-for="x in tiles" :key="x.id" class="tile" :class="{ wide: x.wide, warn: x.warn, ok: x.ok }">
            <small>{{ x.label }}</small>
            <b v-if="x.value != null"><RollNumber :value="x.value" :decimals="x.decimals || 0" :suffix="x.suffix || ''" /></b>
            <b v-else :class="{ mono: x.mono }" :title="x.text">{{ x.text }}</b>
            <span v-if="x.sub" class="sub" :class="{ mono: x.subMono }" :title="x.sub">{{ x.sub }}</span>
          </div>
        </div>
      </div>
    </div>
  </li>
</template>

<style scoped>
.mc{border-radius:var(--r-md);background:rgba(0,0,0,.22);border:1px solid var(--hair);
  transition:background-color var(--t-mid) var(--ease-out),border-color var(--t-mid) var(--ease-out),box-shadow var(--t-mid) var(--ease-out)}
.mc.open{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12);box-shadow:0 0 0 1px rgba(255,107,90,.12),0 10px 26px -14px rgba(240,58,46,.45),inset 0 1px 0 rgba(255,255,255,.04)}
/* Рядок-заголовок: кнопка на всю ширину, тактильне натискання */
.mc .mhead{display:flex;align-items:center;gap:8px;width:100%;min-width:0;padding:11px 12px;margin:0;border:0;border-radius:var(--r-md);background:transparent;color:var(--ink);font:inherit;text-align:left;cursor:pointer;
  transition:transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out)}
.mc .mhead:hover{background:rgba(255,255,255,.035);border:0}
.mc .mhead:active{transform:scale(.985)}
.mc .mhead:focus-visible{outline:2px solid var(--coral);outline-offset:-2px}
.mt{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.chip{flex:none;font:500 10px/1 var(--mono);color:var(--dim);padding:3px 7px;border-radius:999px;border:1px solid var(--hair)}
.sp{flex:1}
.mtemp{flex:none;font-size:15px;font-weight:300}
.chev{flex:none;width:12px;height:12px;fill:none;stroke:var(--dim);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:.7;
  transition:transform var(--t-spring) var(--spring),stroke var(--t-fast) var(--ease-out),opacity var(--t-fast) var(--ease-out)}
.mc.open .chev{transform:rotate(180deg);stroke:var(--coral);opacity:1}
/* Стан шини: зелений — стабільно, бурштиновий — ростуть втрати / шина не active, сірий — MCU не відповідає */
.dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dim)}
.h-ok .dot{background:#34c759;box-shadow:0 0 8px rgba(52,199,89,.7)}
.h-warn .dot{background:#ff9f0a;box-shadow:0 0 8px rgba(255,159,10,.8);animation:wpulse 1.6s cubic-bezier(.45,0,.55,1) infinite}
@keyframes wpulse{50%{opacity:.45}}

/* Акордеон */
.mbody{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--t-spring) var(--spring)}
.mc.open .mbody{grid-template-rows:1fr}
.mclip{overflow:hidden;min-height:0}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px;padding:2px 10px 10px;
  opacity:0;transform:translateY(-6px);transition:opacity .18s var(--ease-out),transform var(--t-spring) var(--spring)}
.mc.open .tiles{opacity:1;transform:none;transition:opacity var(--t-mid) var(--ease-out) .06s,transform var(--t-spring) var(--spring)}
.tile{display:grid;gap:3px;align-content:start;min-width:0;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.04)}
.tile.wide{grid-column:1 / -1}
.tile small{font-size:10px;color:var(--dim);letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile b{font-size:15px;font-weight:300;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile b.mono{font:400 12.5px/1.4 var(--mono)}
.tile .sub{color:var(--dim);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile .sub.mono{font-family:var(--mono)}
.tile.warn b{color:#ffb35c}
.tile.ok b{color:#8fe3a8}
@media(prefers-reduced-motion:reduce){.mbody,.tiles{transition:none}}
</style>

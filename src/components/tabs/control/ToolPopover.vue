<script setup>
// Випадаюче меню голови над смугою T0…TN: температура, швидке задання, плата голови, активація.
// Рендериться в <body> (Teleport): смуга має transform і overflow, які інакше обрізали б меню
// і зсували б position:fixed. Позиція рахується від кнопки голови й обмежується краями вікна.
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useI18n } from '../../../composables/useI18n'
import { toolNum } from '../../../services/klipper'
import ToolBoardInfo from './ToolBoardInfo.vue'
import EddyInfo from './EddyInfo.vue'

const props = defineProps({
  name: { type: String, required: true },   // 'extruder', 'extruder1', …
  index: { type: Number, required: true },  // позиція у списку голів
  anchor: { type: Object, required: true }  // кнопка T<n>, біля якої відкрито меню
})
const emit = defineEmits(['close'])

const MAX_T = 320
const PRESETS = [200, 230, 260, 280]
const GAP = 8      // відступ від смуги та країв вікна
const MAX_W = 320

const printer = usePrinterStore()
const { t, tm } = useI18n()

const num = computed(() => toolNum(props.name))
const ob = computed(() => printer.st[props.name] || {})
const temp = computed(() => ob.value.temperature)
const target = computed(() => ob.value.target)
const active = computed(() => props.name === printer.activeToolName)
const th = computed(() => printer.toolheads[props.name] || null)
/** Датчики BTT Eddy, прив'язані до цієї голови (див. services/eddy.js). */
const eddies = computed(() => printer.eddies[props.name] || [])

// Запасний варіант для старих конфігів: датчик з назвою на кшталт ebb_t0 без прив'язки пінів.
const BOARD_HOT = 75
const legacyBoard = computed(() => {
  const n = printer.boardObjects[num.value]
  if (th.value || !n) return null
  const v = (printer.st[n] || {}).temperature
  return { v: v == null ? null : Number(v) }
})

// --- задання температури ---
const input = ref(target.value ? Math.round(target.value) : '')
watch(target, v => { input.value = v ? Math.round(v) : '' })
const msg = ref(null)

function heat(v = input.value) {
  const n = Number(v)
  if (v === '' || v == null || !Number.isFinite(n) || n < 0 || n > MAX_T) { msg.value = { key: 'tools.badTemp' }; return }
  input.value = n
  msg.value = printer.setToolTarget(props.name, n) ? null : printer.ctlMsg
}
function off() { input.value = 0; heat(0) }

function activate() {
  printer.selectTool(props.index)
  msg.value = printer.toolStatus
}
const activateTitle = computed(() => (printer.isPrinting ? t('msg.notWhilePrinting') : ''))

// --- позиціювання ---
const el = ref(null)
const pos = ref(null)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function place() {
  const a = props.anchor
  if (!a || !a.isConnected) { emit('close'); return }
  const r = a.getBoundingClientRect()
  const strip = (a.closest('.tools') || a).getBoundingClientRect()
  const w = Math.min(MAX_W, innerWidth - GAP * 2)
  const cx = r.left + r.width / 2
  const left = clamp(cx - w / 2, GAP, innerWidth - w - GAP)
  const hb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hb')) || 72
  pos.value = {
    left, width: w,
    bottom: innerHeight - strip.top + GAP,
    maxHeight: Math.max(160, strip.top - hb - GAP * 2),
    arrow: clamp(cx - left, 16, w - 16)
  }
}

// --- закриття: клік поза меню, Esc ---
function onPointerDown(e) {
  if (el.value?.contains(e.target) || props.anchor.contains(e.target)) return
  emit('close')
}
function onKey(e) {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  emit('close')
  props.anchor.focus()
}

let stripEl = null
onMounted(() => {
  place()
  addEventListener('resize', place)
  stripEl = props.anchor.closest('.tools')
  stripEl?.addEventListener('scroll', place, { passive: true })
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKey)
  nextTick(() => el.value?.focus())
})
onBeforeUnmount(() => {
  removeEventListener('resize', place)
  stripEl?.removeEventListener('scroll', place)
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKey)
})
watch(() => props.anchor, place)
</script>

<template>
  <Teleport to="body">
    <div v-if="pos" ref="el" class="tpop" role="dialog" tabindex="-1" :aria-label="'T' + num"
         :style="{ left: pos.left + 'px', bottom: pos.bottom + 'px', width: pos.width + 'px', '--arrow': pos.arrow + 'px' }">
      <div class="body" :style="{ maxHeight: pos.maxHeight + 'px' }">
        <div class="head">
          <strong>T{{ num }}</strong>
          <span class="state" :class="{ on: active }">{{ t(active ? 'tools.statusActive' : 'tools.statusIdle') }}</span>
          <span class="sp"></span>
          <span class="nm" :title="name">{{ name }}</span>
        </div>

        <div class="tline">
          <span class="temp">{{ temp == null ? '–' : Number(temp).toFixed(1) + '°' }}</span>
          <small>/ {{ target == null ? '–' : Math.round(target) + '°C' }}</small>
          <span class="sp"></span>
          <button v-if="printer.canSwitchTools" class="act" :disabled="active || printer.isPrinting" :title="activateTitle" @click="activate">
            {{ t('tools.activate') }}
          </button>
        </div>

        <div class="set">
          <input v-model="input" type="number" min="0" :max="MAX_T" step="1" inputmode="numeric" placeholder="°C" :aria-label="t('tools.aria', { i: num })" @keydown.enter="heat()">
          <button class="primary" @click="heat()">{{ t('common.set') }}</button>
          <button @click="off">{{ t('common.off') }}</button>
        </div>
        <div class="pre">
          <button v-for="p in PRESETS" :key="p" @click="heat(p)">{{ p }}°</button>
        </div>

        <ToolBoardInfo v-if="th" :th="th" />
        <div v-else-if="legacyBoard" class="legacy">{{ t('tools.board') }}
          <span :class="{ hot: legacyBoard.v != null && legacyBoard.v >= BOARD_HOT }">{{ legacyBoard.v == null ? '–' : legacyBoard.v.toFixed(1) + '°' }}</span>
        </div>

        <EddyInfo v-for="e in eddies" :key="e.probeObj" :eddy="e" />

        <div v-if="msg" class="msg">{{ tm(msg) }}</div>
      </div>
      <i class="arrow" aria-hidden="true"></i>
    </div>
  </Teleport>
</template>

<style scoped>
.tpop{position:fixed;z-index:9;background:rgba(22,22,24,.9);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);border:1px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);border-radius:var(--r-lg);box-shadow:0 24px 48px -16px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.05);font-size:12px;color:var(--ink);outline:none}
.body{padding:12px;display:grid;gap:9px;overflow:auto}
.arrow{position:absolute;bottom:-6px;left:calc(var(--arrow) - 6px);width:12px;height:12px;background:rgb(24,24,26);border-right:1px solid var(--edge-lo);border-bottom:1px solid var(--edge-lo);transform:rotate(45deg)}
.head{display:flex;align-items:center;gap:8px;min-width:0}
.head strong{font-size:15px;font-weight:500}
.state{font-size:10px;letter-spacing:.06em;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--dim)}
.state.on{border-color:rgba(240,58,46,.6);color:var(--red)}
.sp{flex:1}
.nm{color:var(--dim);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.tline{display:flex;align-items:baseline;gap:6px}
.temp{font-size:26px;font-weight:200;line-height:1}
.tline small{color:var(--dim);font-size:12px}
.tpop button,.tpop input{background:var(--surface-hi);border:1px solid var(--field-bd);color:var(--ink);font:inherit;font-size:12px;border-radius:var(--r);padding:7px 10px}
.tpop input{background:var(--field-bg)}
.tpop input:focus{outline:none;border-color:rgba(255,107,90,.7);box-shadow:var(--ring)}
.tpop button{cursor:pointer;transition:transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out)}
.tpop button:active:not(:disabled){transform:scale(.95)}
.tpop button:hover:not(:disabled){background-color:rgba(255,255,255,.1)}
.tpop button:disabled{opacity:.35;cursor:not-allowed}
.tpop .primary{background:linear-gradient(180deg,#ff5a4c,#e0321f);border-color:transparent;color:#fff;font-weight:600}
.act{align-self:center}
.set{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px}
.set input{min-width:0;width:100%}
.pre{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.pre button{padding:5px 0}
.legacy{color:var(--dim);font-size:11px}
.hot{color:var(--red)}
.msg{color:var(--dim);font-size:11px}
.tpop :focus-visible{outline:2px solid var(--coral);outline-offset:2px}
/* Низькі екрани (800×480): компактніше, щоб плата голови й BTT Eddy вміщались без прокрутки */
@media(max-height:540px){
  .body{padding:9px 10px;gap:6px}
  .temp{font-size:21px}
  .tpop button,.tpop input{padding:5px 9px}
  .pre button{padding:3px 0}
  .tpop :deep(.tb),.tpop :deep(.ed){padding:6px 9px;gap:3px}
  /* версія прошивки / навантаження MCU — другорядне; «MCU не відповідає» лишається видимим */
  .tpop :deep(.tb .ver){display:none}
}
</style>

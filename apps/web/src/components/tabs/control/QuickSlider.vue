<script setup>
// Скляний поповер швидкого керування для рядка телеметрії (сопло, стіл, швидкість, обдув).
// З'являється ліворуч від панелі (або над нею, якщо збоку не вистачає місця — вузькі екрани),
// має великий слайдер у стилі iOS і пресети під палець. Команда йде, коли палець відпущено
// або натиснуто пресет — не на кожен піксель перетягування.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useUiStore } from '../../../stores/uiStore'
import { useI18n } from '../../../composables/useI18n'
import { toolNum } from '@vyron/shared/klipper/objects'
import { heatRgb } from '@vyron/shared/format'
import { HEAT_PRESETS } from '@vyron/shared/klipper/heat'
// Пресети температур — ті самі матеріали, що на екрані принтера (PLA / PETG / ASA): вимк. + унікальні значення
const uniq = a => [...new Set(a)]
const NOZZLE_PRESETS = [0, ...uniq(HEAT_PRESETS.filter(x => x.id !== 'abs').map(x => x.nozzle))]
const BED_PRESETS = [0, ...uniq(HEAT_PRESETS.map(x => x.bed))]

const props = defineProps({
  kind: { type: String, required: true },     // nozzle | bed | speed | fan
  anchor: { type: Object, default: null },    // рядок панелі, біля якого відкрито
  panel: { type: Object, default: null },     // сама панель телеметрії
  sheet: { type: Boolean, default: false }    // телефон: нижній аркуш на всю ширину замість поповера
})
const emit = defineEmits(['close'])

const printer = usePrinterStore()
const ui = useUiStore()
const { t, tm } = useI18n()

const cfg = computed(() => {
  const tool = printer.activeToolName
  switch (props.kind) {
    case 'nozzle': return {
      title: t('status.nozzle') + (tool ? ' · T' + toolNum(tool) : ''), unit: '°', min: 0, step: 5,
      max: printer.heaterMax[tool] || 300, presets: NOZZLE_PRESETS, heat: true,
      now: printer.nozzleTemp, target: printer.nozzleTarget
    }
    case 'bed': return {
      title: t('status.bed'), unit: '°', min: 0, step: 5, max: printer.heaterMax.heater_bed || 120,
      presets: BED_PRESETS, heat: true, now: printer.bedTemp, target: printer.bedTarget
    }
    case 'speed': return {
      title: t('status.speed'), unit: '%', min: 10, max: 200, step: 5, presets: [50, 100, 150],
      target: printer.speedFactor == null ? null : printer.speedFactor * 100
    }
    default: return {
      title: t('status.fan'), unit: '%', min: 0, max: 100, step: 5, presets: [0, 50, 100],
      target: printer.fanSpeed == null ? null : printer.fanSpeed * 100
    }
  }
})

// Локальне значення слайдера: під час перетягування не перезаписується даними з принтера.
const v = ref(0)
const dragging = ref(false)
const sync = () => { if (!dragging.value) v.value = Math.round(cfg.value.target ?? 0) }
watch(() => cfg.value.target, sync, { immediate: true })

const pct = computed(() => ((v.value - cfg.value.min) / (cfg.value.max - cfg.value.min)) * 100)
// Колір заповнення: для нагрівачів — теплова шкала за ціллю, для швидкості/обдуву — нейтральний.
const fill = computed(() => (cfg.value.heat ? heatRgb(v.value) : props.kind === 'fan' ? '124,199,255' : '242,244,245'))

const err = ref(null)
function send(val) {
  v.value = Math.min(cfg.value.max, Math.max(cfg.value.min, Math.round(val)))
  const ok = printer.quickSet(props.kind, v.value)
  err.value = ok ? null : printer.ctlMsg
}
const onInput = e => { dragging.value = true; v.value = +e.target.value }
const onChange = e => { dragging.value = false; send(+e.target.value) }
const fmt = x => (x == null ? '—' : Math.round(x) + cfg.value.unit)
const presetLabel = p => (p === 0 && props.kind !== 'speed' ? t('qs.off') : p + cfg.value.unit)

function exact() {
  const k = props.kind
  emit('close')
  ui.tempModal = k
}

// ---------- розміщення ----------
const root = ref(null)
const pos = ref({ left: 0, top: 0, origin: 'right center' })
const GAP = 12, EDGE = 8
function place() {
  if (props.sheet) return
  const el = root.value, a = props.anchor, p = props.panel
  if (!el || !a || !p) return
  const ar = a.getBoundingClientRect(), pr = p.getBoundingClientRect()
  const w = el.offsetWidth, h = el.offsetHeight, W = innerWidth, H = innerHeight
  // Не заходимо на шапку: верхня межа — її низ (CSS-змінна --hb, яку ставить AppHeader)
  const top0 = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hb')) || 60) + EDGE
  const clampY = y => Math.min(H - h - EDGE, Math.max(top0, y))
  if (pr.left - GAP - w >= EDGE) {
    // Ліворуч від панелі, по центру рядка
    pos.value = { left: pr.left - GAP - w, top: clampY(ar.top + ar.height / 2 - h / 2), origin: `right ${Math.round(ar.top + ar.height / 2 - clampY(ar.top + ar.height / 2 - h / 2))}px` }
  } else {
    // Вузький екран: над панеллю (або під нею, якщо згори не вміщається), вирівняно по правому краю
    const left = Math.min(W - w - EDGE, Math.max(EDGE, pr.right - w))
    const above = pr.top - GAP - h >= EDGE
    pos.value = { left, top: above ? pr.top - GAP - h : clampY(pr.bottom + GAP), origin: above ? 'center bottom' : 'center top' }
  }
}

const onDoc = e => {
  if (root.value?.contains(e.target) || props.anchor?.contains(e.target)) return
  emit('close')
}
const onKey = e => { if (e.key === 'Escape') emit('close') }
onMounted(() => {
  place()
  addEventListener('resize', place)
  document.addEventListener('pointerdown', onDoc, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  removeEventListener('resize', place)
  document.removeEventListener('pointerdown', onDoc, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="qs glass" :class="{ sheet }" role="dialog" :aria-label="t('qs.adjust', { name: cfg.title })"
       :style="sheet ? { '--fill': fill, '--p': pct + '%' } : { left: pos.left + 'px', top: pos.top + 'px', transformOrigin: pos.origin, '--fill': fill, '--p': pct + '%' }">
    <i v-if="sheet" class="grab" aria-hidden="true"></i>
    <div class="hd">
      <b>{{ cfg.title }}</b>
      <span class="val">{{ fmt(v) }}</span>
    </div>
    <div v-if="cfg.heat" class="now">{{ t('qs.now') }} {{ fmt(cfg.now) }}</div>

    <input class="rng" type="range" :min="cfg.min" :max="cfg.max" :step="cfg.step" :value="v"
           :aria-label="cfg.title" :aria-valuetext="fmt(v)" @input="onInput" @change="onChange">

    <div class="pre">
      <button v-for="p in cfg.presets" :key="p" type="button" :class="{ on: Math.round(cfg.target ?? -1) === p }" @click="send(p)">{{ presetLabel(p) }}</button>
    </div>
    <button v-if="cfg.heat" type="button" class="exact" @click="exact">{{ t('qs.exact') }}</button>
    <div v-if="err" class="err" role="alert">{{ tm(err) }}</div>
  </div>
</template>

<style scoped>
.qs{position:fixed;z-index:12;width:232px;padding:14px;border-radius:20px;display:grid;gap:10px;color:var(--ink);font-size:12px;pointer-events:auto}
.hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.hd b{font-weight:500;font-size:12px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.val{font-size:22px;font-weight:300;letter-spacing:-.02em;color:rgb(var(--fill))}
.now{margin-top:-8px;color:var(--dim);font-size:11px}

/* Слайдер у дусі Control Center: товста капсула, заповнення до поточного значення */
.rng{-webkit-appearance:none;appearance:none;width:100%;height:34px;margin:2px 0;border-radius:12px;cursor:pointer;touch-action:none;
  background:linear-gradient(90deg,rgba(var(--fill),.85) 0,rgba(var(--fill),.85) var(--p),rgba(255,255,255,.1) var(--p));
  box-shadow:inset 0 1px 2px rgba(0,0,0,.35),0 0 18px -6px rgba(var(--fill),.55);transition:box-shadow var(--t-mid) var(--ease-out)}
.rng::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:6px;height:22px;border-radius:3px;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.12),0 2px 6px rgba(0,0,0,.4)}
.rng::-moz-range-thumb{width:6px;height:22px;border:0;border-radius:3px;background:#fff}
.rng::-moz-range-track{background:transparent}
.rng:focus-visible{outline:2px solid var(--coral);outline-offset:3px}

.pre{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}
.pre button,.exact{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.06);color:var(--ink);font:inherit;font-size:12px;border-radius:var(--r);padding:9px 0;cursor:pointer;
  transition:transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out),border-color var(--t-fast) var(--ease-out)}
.pre button:hover,.exact:hover{background:rgba(255,255,255,.1)}
.pre button:active,.exact:active{transform:scale(.94)}
.pre button.on{border-color:rgba(var(--fill),.6);background:rgba(var(--fill),.16)}
.pre button:focus-visible,.exact:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
.exact{padding:7px 0;color:var(--dim);font-size:11px;background:none;border-color:transparent}
.err{color:var(--red);font-size:11px}
/* Нижній аркуш (телефон): на всю ширину, більший слайдер і кнопки під палець */
.qs.sheet{left:0;right:0;bottom:0;top:auto;width:auto;max-width:480px;margin:0 auto;z-index:12;padding:10px 18px calc(20px + env(safe-area-inset-bottom,0px));gap:14px;font-size:13px;
  border-radius:var(--r-xl) var(--r-xl) 0 0;background:rgba(22,22,24,calc(1 - .06 * var(--glass-t,1)))}
.sheet .grab{justify-self:center;width:38px;height:5px;border-radius:3px;background:rgba(255,255,255,.25)}
.sheet .hd b{font-size:14px;color:var(--ink)}
.sheet .val{font-size:32px}
.sheet .rng{height:48px;border-radius:16px}
.sheet .rng::-webkit-slider-thumb{height:30px}
.sheet .pre button{padding:13px 0;font-size:14px}
.sheet .exact{padding:10px 0;font-size:13px}
</style>

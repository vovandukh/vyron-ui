<script setup>
// Статус-капсула в дусі Dynamic Island. Згорнута: індикатор стану + стан + залишок часу.
// На системні події (підключення, QGL, початок/кінець друку…) пружно розширюється з повідомленням
// і за кілька секунд згортається назад. Клік/тап — розкривається на місці з детальним станом і
// адресою хоста, за 1.2 с згортається сам (центр керування відкривається лише кнопкою «…»).
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useI18n } from '../../composables/useI18n'
import { fmtDuration } from '../../utils/format'
import { resolveHost } from '../../services/moonrakerClient'

const printer = usePrinterStore()
const { t, tm } = useI18n()

// У капсулі — лише тривалість («Друк · 1 г 15 хв»), повний текст «залишилось …» — у підказці.
const eta = computed(() => (printer.etaSeconds == null ? '' : fmtDuration(printer.etaSeconds, t)))
const etaFull = computed(() => (eta.value ? t('eta.left', { t: eta.value }) : ''))
const printing = computed(() => printer.printState === 'printing')

// ---------- черга подій ----------
/** Поточна подія: { id, key, params, tone: ok | warn | err | info } або null */
const ev = ref(null)
const queue = []
let timer = 0, shownAt = 0, seq = 0
const SHOW = 3400, SHOW_BUSY = 1700, MIN = 1100

function next() {
  clearTimeout(timer)
  const e = queue.shift()
  ev.value = e || null
  if (!e) return
  shownAt = Date.now()
  timer = setTimeout(next, queue.length ? SHOW_BUSY : SHOW)
}
function push(key, tone = 'info', params) {
  const last = queue.length ? queue[queue.length - 1] : ev.value
  if (last && last.key === key) return
  queue.push({ id: ++seq, key, params, tone })
  if (!ev.value) next()
  else { // щось уже показано: не тримаємо його довше, ніж треба, щоб черга не відставала
    clearTimeout(timer)
    timer = setTimeout(next, Math.max(0, MIN - (Date.now() - shownAt)))
  }
}

// ---------- розкриття по кліку: «Підключено · 192.168.0.232:7125» ----------
const PEEK = 1200
const PEEK_TONE = { ready: 'ok', open: 'ok', lost: 'warn', shutdown: 'err' }
function peek() {
  clearTimeout(timer)
  // Системну подію, яку перервав клік, покажемо одразу після розкриття
  if (ev.value && !ev.value.peek) queue.unshift(ev.value)
  const params = printer.demoMode
    ? { state: t('state.demo'), host: t('island.demoHost') }
    : { state: tm(printer.stateLabel), host: printer.host || resolveHost() || t('island.noHost') }
  ev.value = { id: ++seq, key: 'island.detail', params, tone: PEEK_TONE[printer.link] || 'info', peek: true }
  shownAt = Date.now()
  timer = setTimeout(next, PEEK)   // повторний клік під час розкриття починає відлік заново
}

watch(() => printer.link, (l, o) => {
  if (l === o) return
  if (l === 'demo') push('island.demo', 'info')
  else if (l === 'open') push('island.connected', 'ok', { host: printer.host })
  else if (l === 'ready' && o !== 'open') push('island.ready', 'ok')
  // Лише втрата живого з'єднання. Невдалі спроби перепідключення (connecting → lost кожні 1.5–15 с)
  // не анонсуємо — стан і так видно червоною крапкою в капсулі.
  else if (l === 'lost' && o !== 'connecting') push('island.lost', 'warn')
  else if (l === 'shutdown') push('island.klipperError', 'err')
})
// Тільки реальний перехід false → true: початкове завантаження стану (null → true) — не подія.
watch(() => printer.qgl, (v, o) => {
  if (v === true && o === false) push(printer.leveling?.kind === 'ztilt' ? 'island.ztilt' : 'island.qgl', 'ok')
})
const PRINT_EVENTS = {
  printing: ['island.printStart', 'info'], complete: ['island.printDone', 'ok'], paused: ['island.paused', 'warn'],
  error: ['island.printError', 'err'], cancelled: ['island.cancelled', 'warn']
}
watch(() => printer.printState, (s, o) => {
  if (!o || s === o || !PRINT_EVENTS[s]) return
  if (s === 'printing' && o === 'paused') return
  push(...PRINT_EVENTS[s])
})

// ---------- ширина: вимірюємо вміст і пружно анімуємо width ----------
// У потоці шапки капсула займає лише компактну ширину (slotW); розгорнута подія розширюється ПОВЕРХ
// сусідів (як справжній Dynamic Island), тож шапка не переноситься й --hb не стрибає.
const inner = ref(null)
const w = ref(0), slotW = ref(0)
let ro = null
const measure = () => {
  if (!inner.value) return
  w.value = Math.ceil(inner.value.getBoundingClientRect().width)
  if (!ev.value) slotW.value = w.value
}
onMounted(() => {
  measure()
  if (window.ResizeObserver) { ro = new ResizeObserver(measure); ro.observe(inner.value) }
  // Демо, увімкнене до монтування (?demo), теж варто анонсувати
  if (printer.link === 'demo') push('island.demo', 'info')
})
onBeforeUnmount(() => { ro?.disconnect(); clearTimeout(timer) })
</script>

<template>
  <span class="islot" :style="slotW ? { width: slotW + 'px' } : null">
  <button class="isl" :class="[ev ? 'ex t-' + ev.tone : '', { live: printing }]" :style="w ? { width: w + 'px' } : null"
          :title="t('island.peekTitle')" @click="peek">
    <span ref="inner" class="in">
      <Transition name="sw">
        <span v-if="ev" :key="'e' + ev.id" class="irow" role="status">
          <svg v-if="ev.tone === 'ok'" class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <svg v-else-if="ev.tone === 'info'" class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor" /></svg>
          <svg v-else class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.2v5.6M8 11.6v.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          <span class="msg">{{ t(ev.key, ev.params) }}</span>
        </span>
        <span v-else key="idle" class="irow">
          <span class="dot" :class="'l-' + printer.link"></span>
          <span class="lbl">{{ tm(printer.stateLabel) }}</span>
          <span v-if="eta" class="eta" :title="etaFull">{{ eta }}</span>
        </span>
      </Transition>
    </span>
  </button>
  </span>
</template>

<style scoped>
/* --isl-max — межа згорнутої капсули (довгий ETA обрізається трикрапкою), --isl-max-ex — розгорнутої */
.islot{--isl-max:min(360px,46vw);--isl-max-ex:min(400px,calc(100vw - 150px));position:relative;z-index:3;flex:none;height:30px;
  transition:width var(--t-spring) var(--spring)}
.isl{position:absolute;left:0;top:0;height:30px;padding:0;border-radius:15px;overflow:hidden;cursor:pointer;pointer-events:auto;
  background:#050506;border:1px solid rgba(255,255,255,.07);color:var(--ink);font:inherit;font-size:12px;letter-spacing:0;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 6px 18px -10px rgba(0,0,0,.8);
  transition:width var(--t-spring) var(--spring),box-shadow var(--t-mid) var(--ease-out),border-color var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.isl:active{transform:scale(.96)}
.isl:hover{border-color:rgba(255,255,255,.14)}
.isl:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
.in{display:block;position:relative;width:max-content;max-width:var(--isl-max);height:100%}
.ex .in{max-width:var(--isl-max-ex)}
.irow{display:flex;align-items:center;gap:8px;height:100%;padding:0 13px 0 11px;white-space:nowrap}
.lbl{flex:none;color:var(--ink);font-weight:500}
.eta,.msg{min-width:0;overflow:hidden;text-overflow:ellipsis}
.eta{color:var(--dim)}
.eta::before{content:'·';margin-right:8px;color:var(--dim)}
.msg{font-weight:500}
.ic{width:15px;height:15px;flex:none}

/* Розгорнута капсула: тонке кольорове світіння за тоном події */
.ex.t-ok{border-color:rgba(52,199,89,.35);box-shadow:0 0 0 1px rgba(52,199,89,.1),0 0 22px -4px rgba(52,199,89,.45)}
.ex.t-ok .ic{color:#34c759}
.ex.t-info{border-color:rgba(255,107,90,.35);box-shadow:0 0 22px -4px rgba(255,107,90,.45)}
.ex.t-info .ic{color:var(--coral)}
.ex.t-warn{border-color:rgba(255,159,10,.4);box-shadow:0 0 22px -4px rgba(255,159,10,.45)}
.ex.t-warn .ic{color:#ff9f0a}
.ex.t-err{border-color:rgba(240,58,46,.5);box-shadow:0 0 24px -4px rgba(240,58,46,.6)}
.ex.t-err .ic{color:var(--red)}

.dot{width:7px;height:7px;border-radius:50%;background:var(--dim);flex:none}
.dot.l-open,.dot.l-ready{background:#34c759;box-shadow:0 0 7px rgba(52,199,89,.7)}
.dot.l-demo{background:var(--blue);box-shadow:0 0 7px rgba(120,156,255,.7)}
.dot.l-connecting{background:#ff9f0a;animation:pulse 1.1s cubic-bezier(.45,0,.55,1) infinite}
.dot.l-lost,.dot.l-shutdown{background:var(--red);box-shadow:0 0 7px rgba(240,58,46,.7)}
.live .dot{background:var(--coral);animation:pulse 2.4s cubic-bezier(.45,0,.55,1) infinite}
@keyframes pulse{50%{opacity:.35;box-shadow:none}}

/* Зміна вмісту: старий вміст тане поверх (absolute), новий з'являється — ширина вже тягнеться пружиною */
.sw-enter-active{transition:opacity var(--t-mid) var(--ease-out) .06s,transform var(--t-spring) var(--spring) .06s,filter var(--t-mid) var(--ease-out) .06s}
.sw-leave-active{position:absolute;left:0;top:0;transition:opacity .14s var(--ease-out),filter .14s var(--ease-out)}
.sw-enter-from{opacity:0;transform:scale(.92);filter:blur(3px)}
.sw-leave-to{opacity:0;filter:blur(3px)}

/* Екран принтера 1024×600: шапка (лого + капсула + вкладки + STOP) має влізти в один рядок */
@media(max-width:1100px){.islot{--isl-max:190px}}
@media(max-width:560px){.islot{--isl-max:44vw}.eta{display:none}}
</style>

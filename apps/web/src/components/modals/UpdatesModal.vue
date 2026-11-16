<script setup>
// Центр оновлень (Moonraker Update Manager).
// «Перевірити оновлення» → machine.update.refresh (реальний запит до git/apt; застарілий
// machine.update.status?refresh лише як запасний варіант). Під час перевірки — індикатор активності
// у стилі Apple і відблиск по рядках; після — список перечитується, компоненти з оновленнями
// піднімаються нагору й підсвічуються, а вгорі з'являється підсумок.
import { computed, ref, shallowRef, nextTick, onActivated, onDeactivated, watch } from 'vue'
import { holdReveal } from '@vyron/shared/live'
import { usePrinterStore } from '../../stores/printerStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'
import { demoUpdates } from '../../services/demo'
import { DEMO_BUILD } from '../../config'
import Spinner from '../ui/Spinner.vue'

const printer = usePrinterStore()
const { ask } = useConfirm()
const { t, tm } = useI18n()

const vi = shallowRef({})
const busy = ref(false)
const msg = ref('')
// Журнал оновлення переживає перезавантаження сторінки (зокрема тихе — на нову версію після цього ж оновлення)
const LOG_KEY = 'vyron.updlog', LOG_TTL = 10 * 60 * 1000
function loadLog() {
  try { const v = JSON.parse(sessionStorage.getItem(LOG_KEY) || 'null'); return v && Date.now() - v.at < LOG_TTL ? v.lines : [] } catch { return [] }
}
const logLines = ref(loadLog())
const logEl = ref(null)
/** Іде перевірка (machine.update.refresh) */
const checking = ref(false)
/** Перевірку завершено в цій сесії — показуємо підсумок; лічильник перезапускає анімацію підсвічування */
const checked = ref(false)
const flash = ref(0)
let lid = logLines.value.reduce((m, l) => Math.max(m, l.id), 0)

function addLog(m, cls = '') {
  logLines.value.push({ id: ++lid, m, cls })
  try { sessionStorage.setItem(LOG_KEY, JSON.stringify({ at: Date.now(), lines: logLines.value.slice(-200) })) } catch { /* приватний режим */ }
  nextTick(() => { if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight })
}

const rows = computed(() => {
  const list = Object.keys(vi.value).map((name, i) => {
    const v = vi.value[name] || {}, sys = name === 'system', web = !sys && String(v.configured_type || '').startsWith('web')
    const behind = sys ? v.package_count || 0 : v.commits_behind ? v.commits_behind.length : 0
    const need = web ? !!v.remote_version && v.remote_version !== '?' && v.remote_version !== v.version : behind > 0
    const info = sys ? t('upd.packages', { n: v.package_count || 0 }) : (v.full_version_string || v.version || '–') + (web && need ? ' → ' + v.remote_version : '')
    const flag = v.is_dirty ? t('upd.dirty') : v.is_valid === false ? t('upd.invalid') : ''
    return { name, sys, need, info, i, status: flag || t(need ? 'upd.available' : 'upd.upToDate'), canUpdate: need && !flag }
  })
  // Компоненти з оновленнями — нагору (решта — у порядку Moonraker)
  return list.sort((a, b) => (b.need - a.need) || a.i - b.i)
})
const needCount = computed(() => rows.value.filter(r => r.need).length)

function load() {
  if (DEMO_BUILD && printer.demoMode) { vi.value = demoUpdates; return Promise.resolve() }
  // Ще немає зв'язку (наприклад, одразу після перезавантаження) — завантажимо, щойно він з'явиться
  if (!printer.connected) return Promise.resolve()
  msg.value = ''
  return printer.call('machine.update.status', {})
    .then(r => { vi.value = r.version_info || {}; busy.value = !!r.busy })
    .catch(e => { msg.value = e.message })
}

/** Справжня перевірка: опитати git-віддалені репозиторії й apt (може тривати десятки секунд). */
async function check() {
  if (checking.value) return
  checking.value = true
  msg.value = ''
  try {
    if (DEMO_BUILD && printer.demoMode) {
      await new Promise(r => setTimeout(r, 1600))
      vi.value = demoUpdates
    } else {
      let r
      try { r = await printer.call('machine.update.refresh', {}) }
      catch (e) {
        // Старіші Moonraker: лише status?refresh. Під час друку оновлення заблоковане — показуємо причину.
        if (/print/i.test(e.message || '')) throw e
        r = await printer.call('machine.update.status', { refresh: true })
      }
      vi.value = (r && r.version_info) || vi.value
      busy.value = !!(r && r.busy)
    }
    checked.value = true
    flash.value++
    glow()
  } catch (e) {
    msg.value = e.message || String(e)
  } finally {
    checking.value = false
  }
}

/** Одноразове м'яке світіння рядків з оновленнями (Web Animations — повторюється після кожної перевірки) */
const updEl = ref(null)
function glow() {
  nextTick(() => {
    if (!updEl.value || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    updEl.value.querySelectorAll('.updRow.need').forEach((el, i) => el.animate(
      [{ backgroundColor: 'rgba(var(--accent-rgb),.28)', boxShadow: 'inset 0 0 0 1px rgba(var(--accent-rgb),.45)' }, { backgroundColor: 'rgba(var(--accent-rgb),.06)', boxShadow: 'inset 0 0 0 1px rgba(var(--accent-rgb),0)' }],
      { duration: 1400, delay: 120 + i * 90, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }))
  })
}

async function updateOne(r) {
  if (!(await ask({ key: 'upd.confirmOne', params: { name: r.name } }, true))) return
  addLog({ key: 'upd.updating', params: { name: r.name } })
  const m = r.sys ? 'machine.update.system' : r.name === 'klipper' ? 'machine.update.klipper' : r.name === 'moonraker' ? 'machine.update.moonraker' : 'machine.update.client'
  printer.call(m, m === 'machine.update.client' ? { name: r.name } : {}).catch(e => addLog({ raw: e.message }, 'e'))
}

async function updateAll() {
  if (!(await ask('upd.confirmAll', true))) return
  addLog({ key: 'upd.updatingAll' })
  printer.call('machine.update.full', {}).catch(e => addLog({ raw: e.message }, 'e'))
}

function onResponse(p) {
  if (!p) return
  if (p.message) addLog({ raw: (p.application ? p.application + ': ' : '') + p.message })
  if (p.complete) { addLog({ key: 'upd.finished' }); load() }
}

let offs = [], active = false
watch(() => printer.connected, c => { if (c && active) holdReveal(load()) })
onActivated(() => {
  active = true
  holdReveal(load())
  offs = [printer.on('update_response', onResponse), printer.on('update_refreshed', p => { vi.value = p.version_info || {} })]
})
onDeactivated(() => { active = false; offs.forEach(f => f()); offs = [] })
</script>

<template>
  <section class="view">
    <div class="row">
      <button class="chk" :class="{ on: checking }" :disabled="checking" :aria-busy="String(checking)" @click="check">
        <Transition name="spin"><Spinner v-if="checking" /></Transition>
        <span>{{ checking ? t('upd.checking') : t('upd.check') }}</span>
      </button>
      <button :class="{ primary: needCount > 0 && !checking }" :disabled="printer.isPrinting || checking || !needCount" @click="updateAll">{{ t('upd.all') }}</button>
      <!-- Підсумок перевірки: пружно з'являється після кожної перевірки -->
      <Transition name="sum" mode="out-in">
        <span v-if="checked && !checking" :key="flash + '-' + needCount" class="sum" :class="needCount ? 'has' : 'ok'" role="status">
          <i class="sdot"></i>{{ needCount ? t('upd.availableN', { n: needCount }) : t('upd.allUpToDate') }}
        </span>
      </Transition>
      <span class="msg">{{ msg }}</span>
    </div>
    <div v-if="rows.length" ref="updEl" class="upd" :class="{ checking }">
      <TransitionGroup name="ur">
        <div v-for="r in rows" :key="r.name" class="updRow" :class="{ need: r.need }">
          <span class="n" :title="r.name">{{ r.name }}</span>
          <span class="d" :title="r.info">{{ r.info }}</span>
          <span :class="r.need ? 'needTxt' : 'd'" :title="r.status">{{ r.status }}</span>
          <button :class="{ primary: r.canUpdate }" :disabled="!r.canUpdate || busy || checking || printer.isPrinting" @click="updateOne(r)">{{ t('upd.update') }}</button>
        </div>
      </TransitionGroup>
    </div>
    <div ref="logEl" class="log ulog">
      <div v-for="l in logLines" :key="l.id" :class="l.cls">{{ tm(l.m) }}</div>
    </div>
  </section>
</template>

<style scoped>
.msg{color:var(--coral);font-size:12px}
/* Кнопка перевірки: індикатор активності з'являється зліва від тексту */
.view .chk{display:inline-flex;align-items:center;gap:8px}
.chk.on{color:var(--ink);border-color:rgba(var(--accent-rgb),.45);background:rgba(var(--accent-rgb),.1)}
.view .chk:disabled.on{opacity:1;cursor:progress}
.spin-enter-active{transition:opacity var(--t-fast) var(--ease-out),transform var(--t-spring) var(--spring)}
.spin-enter-from{opacity:0;transform:scale(.4)}

/* Підсумок: зелений «усе актуально» або кораловий «доступно N» */
.sum{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:500;border:1px solid}
.sum.ok{color:#8fe3a8;border-color:rgba(52,199,89,.3);background:rgba(52,199,89,.08)}
.sum.has{color:var(--coral);border-color:rgba(var(--accent-rgb),.35);background:rgba(var(--accent-rgb),.1)}
.sdot{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
.sum.has .sdot{animation:sdot 1.8s cubic-bezier(.45,0,.55,1) infinite}
@keyframes sdot{50%{opacity:.35}}
.sum-enter-active{transition:opacity var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.sum-leave-active{transition:opacity .12s var(--ease-out)}
.sum-enter-from{opacity:0;transform:scale(.85) translateX(-6px)}
.sum-leave-to{opacity:0}

/* Лог під списком: заповнює решту місця, але не менше ~4 рядків */
.view .ulog{flex:1 1 120px;min-height:90px;max-height:none}
.updRow{position:relative;display:grid;grid-template-columns:1fr 1.6fr 1fr auto;gap:12px;align-items:center;padding:10px 14px;font-size:13px;
  transition:background-color var(--t-mid) var(--ease-out)}
.updRow+.updRow{border-top:1px solid var(--hair)}
/* Список компонентів — динамічна висота: при кількох рядках займає рівно стільки, скільки треба,
   при багатьох — бере вільне місце панелі й прокручується сам (раніше overflow:hidden у flex-колонці
   стискав блок і обрізав рядки без прокрутки). Лог під ним лишається видимим. */
.upd{position:relative;flex:0 1 auto;min-height:96px;overflow-y:auto;overscroll-behavior:contain;background:var(--surface);border:1px solid var(--hair);border-radius:var(--r-lg)}
.upd::-webkit-scrollbar-track{margin:12px 0}
.updRow .n{font-weight:500}
.updRow .d{color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.updRow .needTxt{color:var(--coral);font-weight:500}

/* Є оновлення: коралова смужка ліворуч, легкий тон рядка; після перевірки — одноразове м'яке світіння */
.updRow.need{background:rgba(var(--accent-rgb),.06)}
.updRow.need::before{content:'';position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--coral);box-shadow:0 0 10px rgba(var(--accent-rgb),.8)}

/* Перевірка триває: по рядках проходить м'який відблиск */
.upd.checking .updRow::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.06) 50%,transparent 70%);background-size:220% 100%;
  animation:upd-shimmer 1.3s linear infinite}
@keyframes upd-shimmer{from{background-position:120% 0}to{background-position:-120% 0}}

/* Пересортування: рядки з оновленнями пружно «підпливають» нагору */
.ur-move{transition:transform var(--t-spring) var(--spring)}
@media(max-width:700px){.updRow{grid-template-columns:1fr auto}}
</style>

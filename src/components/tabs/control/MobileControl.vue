<script setup>
// «Керування» на телефоні у стилі iOS: 3D-модель зверху, під нею — стовпчик згрупованих карток шириною з телефон
// (на ширших портретних екранах — по центру, не розтягується).
//   • Друк: кільце прогресу (як «Активність»), файл, шар, залишок, Пауза / Скасувати.
//   • Голови T0…TN.
//   • Дані: плитки в стилі «Дому» — кругла іконка, назва, значення; дотик → нижній аркуш зі слайдером.
//   • Рух: сегментований крок, рядки осей із позицією та степером «− | +», дії Home / QGL / Мотори.
// Контейнер прозорий для дотиків — порожній верх лишається за 3D-сценою.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useUiStore } from '../../../stores/uiStore'
import { useI18n } from '../../../composables/useI18n'
import { heatRgb, fmtDuration } from '../../../utils/format'
import RollNumber from '../../ui/RollNumber.vue'
import Spinner from '../../ui/Spinner.vue'
import PrintControls from './PrintControls.vue'
import ToolStrip from './ToolStrip.vue'
import QuickSlider from './QuickSlider.vue'
import ToolPopover from './ToolPopover.vue'

const printer = usePrinterStore()
const settings = useSettingsStore()
const ui = useUiStore()
const { t, tm } = useI18n()

/** Розгорнутий Fold / планшет: дві частини екрана (та сама межа, що й у стилях нижче) */
const wideMq = typeof matchMedia === 'function' ? matchMedia('(min-width: 640px)') : null
const wide = ref(!!(wideMq && wideMq.matches))
const onWide = e => { wide.value = e.matches }
onMounted(() => wideMq?.addEventListener?.('change', onWide))
onBeforeUnmount(() => wideMq?.removeEventListener?.('change', onWide))

const tap = () => { try { navigator.vibrate?.(6) } catch { /* ignore */ } }

// ---------- друк ----------
const ps = computed(() => printer.st.print_stats || {})
const file = computed(() => (printer.preview ? printer.preview.name : ps.value.filename) || '')
const pct = computed(() => printer.progressPct || 0)
const R = 26, C = 2 * Math.PI * R
const dash = computed(() => C * (1 - Math.min(100, pct.value) / 100))
const STATE_TONE = { printing: 'live', paused: 'warn', complete: 'ok', error: 'err', cancelled: 'warn' }
const tone = computed(() => STATE_TONE[printer.printState] || 'idle')
const eta = computed(() => (printer.etaSeconds == null ? '' : t('eta.left', { t: fmtDuration(printer.etaSeconds, t) })))
const layer = computed(() => (['printing', 'paused', 'complete'].includes(printer.printState) && printer.layerText && printer.layerText !== '–' ? printer.layerText : ''))

// ---------- дані ----------
const mm = computed(() => t('unit.mm', { v: '' }))
const tiles = computed(() => {
  const p = printer, out = []
  const ok = v => v != null && Number.isFinite(v)
  // Одна голова: сопло показує вбудована картка голови нижче — плитка була б дублем
  if (p.toolObjects.length > 1 && ok(p.nozzleTemp)) out.push({ id: 'nozzle', icon: 'nozzle', label: t('status.nozzleShort'), value: p.nozzleTemp, unit: '°', target: p.nozzleTarget, heat: p.nozzleTemp, quick: true })
  if (p.hasBed && ok(p.bedTemp)) out.push({ id: 'bed', icon: 'bed', label: t('status.bed'), value: p.bedTemp, unit: '°', target: p.bedTarget, heat: p.bedTemp, range: [30, 100], quick: true })
  if (p.chamberObj && ok(p.chamberTemp)) out.push({ id: 'chamber', icon: 'chamber', label: t('status.chamber'), value: p.chamberTemp, unit: '°', heat: p.chamberTemp, range: [25, 70] })
  if (ok(p.speedFactor)) out.push({ id: 'speed', icon: 'speed', label: t('status.speed'), value: p.speedFactor * 100, unit: '%', quick: true, tint: '255,159,10' })
  if (p.hasFan && ok(p.fanSpeed)) out.push({ id: 'fan', icon: 'fan', label: t('status.fan'), value: p.fanSpeed * 100, unit: '%', quick: true, tint: '100,210,255' })
  if (p.position) out.push({ id: 'z', icon: 'z', label: t('status.z'), value: Number(p.position[2]), unit: mm.value, decimals: 1, tint: '191,90,242' })
  return out
})
const tint = x => ({ '--c': x.heat != null ? heatRgb(x.heat, ...(x.range || [])) : x.tint })
const sub = x => (x.target == null ? '' : x.target > 0 ? '→ ' + Math.round(x.target) + '°' : t('qs.off'))
const ICON = {
  nozzle: 'M9 3h6v5l-1.5 2h-3L9 8ZM10.5 10 12 14l1.5-4M7 19c1.2-1 2.2-1 3.4 0s2.2 1 3.4 0 2.2-1 3.4 0',
  bed: 'M3 15h18v3H3ZM6 15v-2M18 15v-2M7 10c1-1 2-1 3 0s2 1 3 0 2-1 3 0',
  chamber: 'M4 4h16v16H4ZM4 9h16M9 13h6',
  speed: 'M4.5 16a8 8 0 1 1 15 0M12 16l4-5',
  fan: 'M12 12c0-4 1-7 4-7s3 4-4 7Zm0 0c4 0 7 1 7 4s-4 3-7-4Zm0 0c0 4-1 7-4 7s-3-4 4-7Zm0 0c-4 0-7-1-7-4s4-3 7 4Z',
  z: 'M12 3v18M8.5 6.5 12 3l3.5 3.5M8.5 17.5 12 21l3.5-3.5'
}
const open = ref(null)
const tileEls = {}
function openTile(x) { if (!x.quick) return; tap(); open.value = open.value === x.id ? null : x.id }
watch(() => ui.view, v => { if (v !== 'main') open.value = null })
watch(() => ui.homeTick, () => { open.value = null })

// ---------- рух ----------
const STEPS = [0.1, 1, 10, 50]
const step = ref(10)
const busy = computed(() => printer.isPrinting)
function jog(a, dir) {
  tap()
  const v = a === 'Z' ? Math.min(step.value, 10) : step.value
  const d = dir * v * (settings['inv' + a] ? -1 : 1)
  printer.rpc('G91\nG1 ' + a + d + ' F' + (a === 'Z' ? settings.fz : settings.fxy) + '\nG90')
}
const homed = computed(() => String((printer.st.toolhead || {}).homed_axes || ''))
const pos = i => (printer.position ? Number(printer.position[i]).toFixed(1) : '–')
const lvlName = computed(() => (printer.leveling && printer.leveling.kind === 'ztilt' ? 'Z-Tilt' : 'QGL'))
async function level() {
  tap()
  printer.ctlMsg = null
  try { await printer.levelGantry() } catch (e) { printer.ctlMsg = { key: 'jog.levelFailed', params: { msg: (e && e.message) || '' } } }
}
const act = s => { tap(); printer.rpc(s) }
</script>

<template>
  <div class="mc">
    <!-- Ліва частина (на розгорнутому Fold — під моделлю): друк і голови -->
    <div class="pane pl">
    <!-- ---------- друк ---------- -->
    <section class="grp hero" :class="'t-' + tone">
      <div class="hrow">
        <div class="ring" role="img" :aria-label="pct + '%'">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" :r="R" class="trk" />
            <circle cx="32" cy="32" :r="R" class="bar" :stroke-dasharray="C" :stroke-dashoffset="dash" />
          </svg>
          <b><RollNumber :value="pct" /><small>%</small></b>
        </div>
        <div class="info">
          <span class="st"><i></i>{{ tm(printer.stateLabel) }}</span>
          <b class="file" :title="file">{{ file || tm(printer.meta) }}</b>
          <span v-if="layer || eta" class="sub">{{ [layer && t('status.layer') + ' ' + layer, eta].filter(Boolean).join(' · ') }}</span>
        </div>
      </div>
      <PrintControls v-if="printer.printBusy && !printer.preview" class="pcm" />
    </section>

    <!-- Голови: одна — «пігулка» з платою; 2–3 — компактно по центру; більше — смуга на всю ширину -->
    <div v-if="printer.toolCount > 1 && !wide" class="tl"><ToolStrip inline /></div>
    </div>

    <!-- Права частина (на розгорнутому Fold — окрема панель): дані й рух -->
    <div class="pane pr">

    <!-- Розгорнутий Fold: голови — у правій панелі, щоб акордеон не піднімав картку друку на модель -->
    <template v-if="printer.toolCount > 1 && wide">
      <h3 class="cap">{{ t('mob.heads') }}</h3>
      <div class="tl"><ToolStrip inline /></div>
    </template>

    <!-- ---------- дані ---------- -->
    <template v-if="tiles.length">
      <h3 class="cap">{{ t('mob.data') }}</h3>
      <section class="tiles">
        <component :is="x.quick ? 'button' : 'div'" v-for="x in tiles" :key="x.id" :ref="el => { if (el) tileEls[x.id] = el.$el || el }"
                   class="tile" :class="{ q: x.quick, on: open === x.id }" :style="tint(x)" :type="x.quick ? 'button' : null"
                   :aria-haspopup="x.quick ? 'dialog' : null" @click="openTile(x)">
          <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="ICON[x.icon]" /></svg></span>
          <span class="tx">
            <small>{{ x.label }}</small>
            <b><RollNumber :value="x.value" :decimals="x.decimals || 0" /><em>{{ x.unit }}</em></b>
          </span>
          <span v-if="sub(x)" class="tg">{{ sub(x) }}</span>
        </component>
      </section>
    </template>

    <!-- ---------- одна голова: її картка прямо тут (температура, задання, плата, Eddy) ---------- -->
    <template v-if="printer.toolCount === 1">
      <h3 class="cap">{{ t('mob.head') }}</h3>
      <ToolPopover :name="printer.toolObjects[0]" :index="0" inline />
    </template>

    <!-- ---------- рух ---------- -->
    <h3 class="cap">{{ t('jog.title') }}</h3>
    <section class="grp mv">
      <div class="seg" role="radiogroup" :aria-label="t('jog.stepAll')">
        <button v-for="s in STEPS" :key="s" type="button" role="radio" :aria-checked="String(step === s)" :class="{ on: step === s }" @click="step = s; tap()">{{ s }}</button>
      </div>
      <div v-for="(a, i) in ['X', 'Y', 'Z']" :key="a" class="axr">
        <span class="al" :class="{ h: homed.includes(a.toLowerCase()) }">{{ a }}</span>
        <span class="pv">{{ pos(i) }}<em>{{ mm }}</em></span>
        <span class="stp" role="group" :aria-label="a">
          <button type="button" :disabled="busy" :aria-label="a + ' −'" @click="jog(a, -1)"><svg viewBox="0 0 16 16"><path d="M3.5 8h9" /></svg></button>
          <i aria-hidden="true"></i>
          <button type="button" :disabled="busy" :aria-label="a + ' +'" @click="jog(a, 1)"><svg viewBox="0 0 16 16"><path d="M3.5 8h9M8 3.5v9" /></svg></button>
        </span>
      </div>
      <div class="acts">
        <button type="button" :disabled="busy" @click="act('G28')">
          <svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5M6.5 10v9h11v-9" /></svg>{{ t('jog.homeAll') }}
        </button>
        <button v-if="printer.leveling" type="button" class="lv" :class="{ ok: printer.qgl === true, need: printer.qgl === false }" :disabled="busy || printer.levelingBusy" @click="level">
          <Spinner v-if="printer.levelingBusy" :size="13" />
          <svg v-else viewBox="0 0 24 24"><path d="M4 15h16M7 15V9M17 15V9" /><circle cx="7" cy="7" r="1.6" /><circle cx="17" cy="7" r="1.6" /></svg>
          {{ lvlName }}<i v-if="printer.qgl != null && !printer.levelingBusy"></i>
        </button>
        <button type="button" :disabled="busy" @click="act('M84')">
          <svg viewBox="0 0 24 24"><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>{{ t('jog.motorsShort') }}
        </button>
      </div>
      <p v-if="printer.ctlMsg" class="msg" role="status">{{ tm(printer.ctlMsg) }}</p>
    </section>
    </div>

    <Transition name="shb"><div v-if="open" class="shade" aria-hidden="true"></div></Transition>
    <Transition name="sh">
      <QuickSlider v-if="open && tileEls[open]" :key="open" :kind="open" :anchor="tileEls[open]" sheet @close="open = null" />
    </Transition>
  </div>
</template>

<style scoped>
/* Стовпчик шириною з телефон: на ширших екранах — по центру з полями, а не на всю ширину */
.mc{--w:440px;position:fixed;left:0;right:0;top:var(--hb,72px);bottom:0;z-index:3;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;pointer-events:none;
  display:flex;flex-direction:column;gap:8px;padding:max(34vh,190px) max(14px,calc((100vw - var(--w)) / 2)) calc(20px + env(safe-area-inset-bottom,0px));
  scrollbar-width:none;font-size:13px;-webkit-font-smoothing:antialiased}
.mc::-webkit-scrollbar{display:none}
/* На телефоні частини — просто ланки одного стовпчика */
.pane{display:contents}
.pane>*,.mc>.shade+*{pointer-events:auto;flex-shrink:0}
.mc>.shade{pointer-events:none}
button{font:inherit;color:var(--ink);cursor:pointer;-webkit-tap-highlight-color:transparent}
button:disabled{opacity:.3;cursor:not-allowed}
button:focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* Згрупована картка iOS: спокійне скло без світіння */
.grp,.tile{background:rgba(28,28,30,calc(1 - .25 * var(--glass-t,1)));-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);
  border:.5px solid rgba(255,255,255,.08);box-shadow:0 8px 24px -16px rgba(0,0,0,.8)}
.grp{border-radius:var(--r-xl);padding:14px}
/* Підпис секції над групою — як у «Параметрах» */
.cap{margin:10px 6px 0;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--dim);text-transform:uppercase}

/* ---------- друк ---------- */
.hero{display:grid;gap:12px}
.hrow{display:flex;align-items:center;gap:14px}
.ring{position:relative;flex:none;width:64px;height:64px}
.ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.ring circle{fill:none;stroke-width:6}
.trk{stroke:rgba(var(--brand-rgb),.18)}
.bar{stroke:var(--brand);stroke-linecap:round;transition:stroke-dashoffset .8s var(--ease-out)}
.ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;letter-spacing:-.02em;--rn-h:1.1em}
.ring b small{font-size:.6em;font-weight:500;color:var(--dim);margin-left:1px}
.info{display:grid;gap:2px;min-width:0}
.st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--dim)}
.st i{width:7px;height:7px;border-radius:50%;background:var(--dim)}
.t-live .st{color:var(--coral)}
.t-live .st i{background:var(--coral);animation:mc-pulse 2s ease-in-out infinite}
.t-warn .st{color:#ff9f0a}.t-warn .st i{background:#ff9f0a}
.t-ok .st{color:#30d158}.t-ok .st i{background:#30d158}
.t-err .st{color:var(--red)}.t-err .st i{background:var(--red)}
@keyframes mc-pulse{50%{opacity:.35}}
.file{font-size:16px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{color:var(--dim);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcm{padding:0}
.pcm :deep(.b){min-height:40px;border-radius:12px;font-size:13px}

/* ---------- голови ---------- */
/* Непарна кількість плиток — остання на всю ширину, без «дірки» */
.tile:last-child:nth-child(odd){grid-column:1/-1}

/* ---------- дані: плитки «Дому» ---------- */
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tile{position:relative;display:flex;align-items:center;gap:10px;min-height:62px;padding:10px 12px;border-radius:var(--r-lg);text-align:left;
  transition:transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out)}
.tile.q:active{transform:scale(.96)}
.tile.on{background:rgba(var(--c),.16)}
.ic{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(var(--c),.18);color:rgb(var(--c))}
.ic svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.tx{display:grid;min-width:0}
.tx small{font-size:12px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tx b{display:flex;align-items:baseline;font-size:19px;font-weight:600;letter-spacing:-.02em;line-height:1.2;white-space:nowrap}
.tx em{font-style:normal;font-size:.62em;font-weight:500;color:var(--dim);margin-left:1px}
.tg{position:absolute;right:12px;top:10px;font-size:11px;color:var(--dim)}

/* ---------- рух ---------- */
.mv{display:grid;gap:0;padding:6px 14px}
/* Сегментований перемикач iOS */
.seg{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;padding:2px;margin:8px 0 6px;border-radius:9px;background:rgba(118,118,128,.24)}
.seg button{border:0;border-radius:7px;padding:6px 0;background:transparent;font-size:13px;font-weight:500;color:var(--ink);
  transition:background-color var(--t-fast) var(--ease-out)}
.seg button.on{background:rgba(255,255,255,.2);box-shadow:0 3px 8px rgba(0,0,0,.25),0 0 0 .5px rgba(0,0,0,.04);font-weight:600}
/* Рядки осей з тонкими розділювачами */
.axr{display:flex;align-items:center;gap:12px;min-height:50px;border-top:.5px solid rgba(255,255,255,.1)}
.seg+.axr{border-top:0}
.al{flex:none;width:26px;height:26px;border-radius:7px;display:grid;place-items:center;font-size:13px;font-weight:700;color:var(--dim);background:rgba(118,118,128,.24)}
.al.h{color:#fff;background:var(--brand)}
.pv{flex:1;font-size:17px;font-variant-numeric:tabular-nums}
.pv em{font-style:normal;font-size:12px;color:var(--dim);margin-left:2px}
/* Степер iOS: «− | +» в одній капсулі */
.stp{flex:none;display:flex;align-items:center;height:32px;border-radius:9px;background:rgba(118,118,128,.24);overflow:hidden}
.stp button{width:47px;height:100%;border:0;background:transparent;display:grid;place-items:center;transition:background-color var(--t-fast) var(--ease-out)}
.stp button:active:not(:disabled){background:rgba(255,255,255,.14)}
.stp svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.stp i{width:.5px;height:18px;background:rgba(255,255,255,.2)}
/* Дії: тоновані кнопки iOS */
.acts{display:flex;gap:8px;padding:10px 0 8px;border-top:.5px solid rgba(255,255,255,.1)}
.acts button{flex:1 1 0;min-width:0;position:relative;display:flex;align-items:center;justify-content:center;gap:6px;height:36px;border:0;border-radius:10px;font-size:13px;font-weight:600;
  color:var(--coral);background:rgba(var(--accent-rgb),.14);transition:transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out)}
.acts button:active:not(:disabled){transform:scale(.96);background:rgba(var(--accent-rgb),.22)}
.acts svg{flex:none;width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.acts .lv svg circle{fill:currentColor;stroke:none}
.acts .lv i{position:absolute;top:6px;right:8px;width:6px;height:6px;border-radius:50%}
.acts .lv.ok i{background:#30d158}
.acts .lv.need i{background:#ff9f0a}
.msg{margin:0 0 8px;color:#ff9f0a;font-size:12px}

/* ---------- розгорнутий Fold / планшет у портреті (≥640 px): дві частини без загального скролу ---------- */
/* Ліворуч — 3D-модель (PrintPreview3D зсуває її в центр лівої частини) і картка друку внизу;
   праворуч — панель даних і руху зі своєю прокруткою, якщо не вміститься. */
@media(min-width:640px){
  .mc{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,380px);gap:16px;overflow:hidden;padding:12px 16px calc(16px + env(safe-area-inset-bottom,0px))}
  .pane{display:flex;flex-direction:column;gap:8px;min-height:0}
  .pl{justify-content:flex-end;pointer-events:none}
  .pl>*{pointer-events:auto}
  .pr{overflow-y:auto;overscroll-behavior:contain;pointer-events:auto;scrollbar-width:none;padding-bottom:4px}
  .pr::-webkit-scrollbar{display:none}
  .pr>.cap:first-child{margin-top:2px}
}

/* Нижній аркуш */
.shade{position:fixed;inset:0;z-index:11;background:rgba(0,0,0,.4)}
.shb-enter-active,.shb-leave-active{transition:opacity var(--t-mid) var(--ease-out)}
.shb-enter-from,.shb-leave-to{opacity:0}
.sh-enter-active{transition:transform var(--t-spring) var(--spring)}
.sh-leave-active{transition:transform .22s var(--ease-out)}
.sh-enter-from,.sh-leave-to{transform:translateY(105%)}
</style>

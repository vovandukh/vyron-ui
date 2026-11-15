<script setup>
// Налаштування: заголовок із вкладками «Загальні | Дизайн».
// Загальні — картки розділів (інтерфейс, безпека, рух, про систему), розкладені колонками на всю ширину панелі.
import { ref, computed, onMounted, onActivated, watch } from 'vue'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePrinterStore } from '../../stores/printerStore'
import { useDesignStore } from '../../stores/designStore'
import { useI18n } from '../../composables/useI18n'
import { resolveHost } from '../../services/moonrakerClient'
import { version as uiVersion } from '../../../package.json'
import GlassSelect from '../ui/GlassSelect.vue'
import StepperInput from '../ui/StepperInput.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import DesignPanel from './DesignPanel.vue'
import { useConfirm } from '../../composables/useConfirm'
import { chime } from '../../services/sound'
import { DEFAULT_SETTINGS } from '../../stores/settingsStore'

const settings = useSettingsStore()
const printer = usePrinterStore()
const design = useDesignStore()
const { t, tm } = useI18n()

const LANGS = [
  { value: 'uk', label: 'Українська', hint: 'UK' },
  { value: 'en', label: 'English', hint: 'EN' }
]
/** Підрозділи налаштувань: загальні | дизайн (вигляд інтерфейсу) */
const tab = ref('gen')
const TABS = computed(() => [{ value: 'gen', label: t('set.tabGeneral') }, { value: 'design', label: t('set.tabDesign') }])
/** Швидкості руху: крок «−/+» і межі (мм/хв) */
const numbers = [
  { k: 'fxy', step: 100, min: 100, max: 30000 },
  { k: 'fz', step: 50, min: 10, max: 6000 }
]

// ---------- про систему ----------
const sys = ref({ klipper: null, moonraker: null, hostname: null })
async function loadSys() {
  if (printer.demoMode) { sys.value = { klipper: 'v0.13.0-560-gaea1bcf', moonraker: 'v0.9.3-41-g3f9d2c1', hostname: 'voron-demo' }; return }
  if (!printer.connected) { sys.value = { klipper: null, moonraker: null, hostname: null }; return }
  const [p, s] = await Promise.allSettled([printer.call('printer.info'), printer.call('server.info')])
  sys.value = {
    klipper: p.status === 'fulfilled' ? p.value.software_version : null,
    hostname: p.status === 'fulfilled' ? p.value.hostname : null,
    moonraker: s.status === 'fulfilled' ? s.value.moonraker_version : null
  }
}
onMounted(loadSys)
onActivated(loadSys)
watch(() => printer.link, loadSys)
const os = computed(() => { const d = (printer.hostInfo || {}).distribution || {}; return d.name || null })
const about = computed(() => [
  { k: 'set.ui', v: 'Vyron UI v' + uiVersion },
  { k: 'set.klipper', v: sys.value.klipper, mono: true },
  { k: 'set.moonraker', v: sys.value.moonraker, mono: true },
  { k: 'set.host', v: sys.value.hostname },
  { k: 'set.os', v: os.value },
  { k: 'set.addr', v: printer.demoMode ? t('island.demoHost') : printer.host || resolveHost(), mono: true }
])
// ---------- дані: експорт / імпорт / скидання (налаштування + дизайн одним файлом) ----------
const { confirm } = useConfirm()
const file = ref(null)
const dataMsg = ref(null)
let msgTimer = 0
function say(key, err = false) { dataMsg.value = { key, err }; clearTimeout(msgTimer); msgTimer = setTimeout(() => { dataMsg.value = null }, 4000) }
function exportAll() {
  const data = { app: 'vyron-ui', version: uiVersion, exported: new Date().toISOString(), settings: { ...settings.$state }, design: { ...design.d } }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  a.download = 'vyron-ui-settings.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  say('set.exported')
}
async function importAll(e) {
  const f = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!f) return
  try {
    const data = JSON.parse(await f.text())
    if (!data || typeof data !== 'object' || (!data.settings && !data.design)) throw new Error('format')
    for (const [k, v] of Object.entries(data.settings || {})) settings.set(k, v)
    if (data.design) design.importDesign(data.design)
    say('set.imported')
  } catch { say('set.importBad', true) }
}
async function resetAll() {
  if (!(await confirm('set.resetConfirm', { okKey: 'set.resetAll' }))) return
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) settings.set(k, v)
  design.reset()
  say('set.resetDone')
}
const presetName = computed(() => t('design.p.' + design.d.preset))
</script>

<template>
  <section class="view set">
    <header class="top">
      <div class="ttl">
        <span class="tic" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" /><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4Z" /></svg>
        </span>
        <div>
          <h1>{{ t('menu.settings') }}</h1>
          <small>{{ t(tab === 'gen' ? 'set.subGeneral' : 'set.subDesign') }}</small>
        </div>
      </div>
      <SegmentedControl v-model="tab" :options="TABS" :aria-label="t('menu.settings')" />
    </header>

    <Transition name="stab" mode="out-in">
      <DesignPanel v-if="tab === 'design'" key="d" />
      <div v-else key="g" class="cols">
        <!-- ---------- інтерфейс ---------- -->
        <article class="crd">
          <header class="ch">
            <span class="ci"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></svg></span>
            <div><b>{{ t('set.secUi') }}</b><small>{{ t('set.secUiHint') }}</small></div>
          </header>
          <div class="rows">
            <div class="srow">
              <span>{{ t('set.lang') }}</span>
              <GlassSelect :model-value="settings.lang" :options="LANGS" :aria-label="t('set.lang')" @update:model-value="settings.set('lang', $event)" />
            </div>
            <button type="button" class="srow lnk" @click="tab = 'design'">
              <span>{{ t('set.design') }}<small>{{ presetName }} · {{ t('set.designHint') }}</small></span>
              <span class="theme" aria-hidden="true">
                <i :style="{ background: `linear-gradient(145deg, ${design.d.accent}, ${design.d.brand})` }"></i>
                <svg viewBox="0 0 16 16"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
              </span>
            </button>
          </div>
        </article>

        <!-- ---------- безпека ---------- -->
        <article class="crd">
          <header class="ch">
            <span class="ci"><svg viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6Z" /><path d="m8.8 12.2 2.2 2.2 4.3-4.6" /></svg></span>
            <div><b>{{ t('set.secSafety') }}</b><small>{{ t('set.secSafetyHint') }}</small></div>
          </header>
          <div class="rows">
            <label v-for="k in ['cEstop', 'cSys']" :key="k" class="srow">
              <span>{{ t('set.' + k + 'Short') }}<small>{{ t('set.' + k + 'Hint') }}</small></span>
              <input type="checkbox" :checked="settings[k]" @change="settings.set(k, $event.target.checked)">
            </label>
          </div>
        </article>

        <!-- ---------- рух ---------- -->
        <article class="crd">
          <header class="ch">
            <span class="ci"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" /></svg></span>
            <div><b>{{ t('set.secMotion') }}</b><small>{{ t('set.secMotionHint') }}</small></div>
          </header>
          <div class="rows">
            <div class="srow wr">
              <span>{{ t('set.inv') }}<small>{{ t('set.invHint') }}</small></span>
              <span class="axes" role="group" :aria-label="t('set.inv')">
                <button v-for="a in ['X', 'Y', 'Z']" :key="a" type="button" role="switch" class="ax" :class="{ on: settings['inv' + a] }"
                        :aria-checked="String(settings['inv' + a])" :title="t('set.inv' + a)" @click="settings.set('inv' + a, !settings['inv' + a])">
                  {{ a }}<i aria-hidden="true">⇄</i>
                </button>
              </span>
            </div>
            <div v-for="n in numbers" :key="n.k" class="srow wr">
              <span>{{ t('set.' + n.k + 'Short') }}<small>{{ t('set.' + n.k + 'Hint') }}</small></span>
              <StepperInput :model-value="settings[n.k]" :step="n.step" :min="n.min" :max="n.max" :aria-label="t('set.' + n.k)"
                            @update:model-value="settings.set(n.k, $event)" />
            </div>
          </div>
        </article>

        <!-- ---------- сповіщення ---------- -->
        <article class="crd">
          <header class="ch">
            <span class="ci"><svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg></span>
            <div><b>{{ t('set.secNotify') }}</b><small>{{ t('set.secNotifyHint') }}</small></div>
          </header>
          <div class="rows">
            <label class="srow">
              <span>{{ t('set.toasts') }}<small>{{ t('set.toastsHint') }}</small></span>
              <input type="checkbox" :checked="settings.toasts" @change="settings.set('toasts', $event.target.checked)">
            </label>
            <div class="srow">
              <span>{{ t('set.sound') }}<small>{{ t('set.soundHint') }}</small></span>
              <span class="pair">
                <button type="button" class="mini" :title="t('set.soundTest')" :aria-label="t('set.soundTest')" @click="chime('done')">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6h2.5L9 3v10L5.5 10H3Z" /><path d="M11.5 5.5a3.5 3.5 0 0 1 0 5" /></svg>
                </button>
                <input type="checkbox" :checked="settings.sound" :aria-label="t('set.sound')" @change="settings.set('sound', $event.target.checked)">
              </span>
            </div>
          </div>
        </article>

        <!-- ---------- про систему ---------- -->
        <article class="crd">
          <header class="ch">
            <span class="ci"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r="1.1" class="f" /></svg></span>
            <div><b>{{ t('set.secAbout') }}</b><small>{{ tm(printer.stateLabel) }}</small></div>
          </header>
          <dl class="kv">
            <template v-for="r in about" :key="r.k">
              <dt>{{ t(r.k) }}</dt>
              <dd :class="{ mono: r.mono, dim: !r.v }" :title="r.v || ''">{{ r.v || '—' }}</dd>
            </template>
          </dl>
          <p class="note">{{ t('set.note') }}</p>
        </article>
        <!-- ---------- дані ---------- -->
        <article class="crd">
          <header class="ch">
            <span class="ci"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7.5" ry="2.8" /><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></svg></span>
            <div><b>{{ t('set.secData') }}</b><small>{{ t('set.secDataHint') }}</small></div>
          </header>
          <div class="acts">
            <button type="button" @click="exportAll">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" /></svg>{{ t('set.export') }}
            </button>
            <button type="button" @click="file.click()">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5v-8M4.5 6 8 2.5 11.5 6M3 13.5h10" /></svg>{{ t('set.import') }}
            </button>
            <button type="button" class="danger" @click="resetAll">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5" /></svg>{{ t('set.resetAll') }}
            </button>
            <input ref="file" type="file" accept="application/json,.json" hidden @change="importAll">
          </div>
          <p v-if="dataMsg" class="note" :class="{ err: dataMsg.err }" role="status">{{ t(dataMsg.key) }}</p>
        </article>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.set{gap:18px}
/* ---------- заголовок ---------- */
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.ttl{display:flex;align-items:center;gap:14px;min-width:0}
.tic{flex:none;width:44px;height:44px;border-radius:var(--r-md);display:grid;place-items:center;color:var(--coral);
  background:radial-gradient(circle at 50% 30%,rgba(var(--accent-rgb),.22),rgba(var(--accent-rgb),.06));border:1px solid rgba(var(--accent-rgb),.28);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 24px -8px rgba(var(--brand-rgb),.7)}
.tic svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round}
h1{margin:0;font-size:20px;font-weight:600;letter-spacing:-.01em}
.ttl small{color:var(--dim);font-size:12px}
.top :deep(.seg){align-self:center}

/* ---------- картки колонками (masonry: кожна картка — ціла в колонці) ---------- */
.cols{columns:3 340px;column-gap:14px}
.crd{break-inside:avoid;margin-bottom:14px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--r-lg);overflow:hidden}
.ch{display:flex;align-items:center;gap:12px;padding:14px 14px 12px}
.ch b{display:block;font-size:13.5px;font-weight:600}
.ch small{display:block;margin-top:2px;color:var(--dim);font-size:11.5px;line-height:1.35}
.ci{flex:none;width:34px;height:34px;border-radius:var(--r);display:grid;place-items:center;color:var(--coral);background:rgba(var(--accent-rgb),.1);border:1px solid rgba(var(--accent-rgb),.2)}
.ci svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.ci .f{fill:currentColor;stroke:none}
.rows{border-top:1px solid var(--hair)}
.srow{display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:13px;padding:10px 14px;min-height:56px;width:100%;text-align:left}
.srow+.srow{border-top:1px solid var(--hair)}
label.srow{cursor:pointer}
.srow>span:first-child{display:grid;gap:2px;line-height:1.35;min-width:0}
.srow small{color:var(--dim);font-size:11px;font-weight:400}
/* Рядок-посилання на вкладку «Дизайн» */
.view .srow.lnk{background:none;border:0;border-top:1px solid var(--hair);border-radius:0;padding:10px 14px;font-size:13px;color:var(--ink)}
.view .srow.lnk:hover:not(:disabled){background:rgba(255,255,255,.04);border-color:var(--hair)}
.view .srow.lnk:active:not(:disabled){transform:none;background:rgba(255,255,255,.06)}
.theme{display:flex;align-items:center;gap:10px;color:var(--dim)}
.theme i{width:26px;height:26px;border-radius:50%;box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 0 2px #19191b,0 0 0 3px rgba(255,255,255,.14)}
.theme svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

/* Інверсія осей: три перемикачі-«пігулки» */
.axes{display:flex;gap:6px;flex:none}
.view .ax{display:inline-flex;align-items:center;gap:6px;min-width:52px;justify-content:center;padding:8px 10px;font-weight:600;border-radius:999px;color:var(--dim)}
.ax i{font-style:normal;font-size:11px;opacity:.5;transition:transform var(--t-spring) var(--spring),opacity var(--t-fast) var(--ease-out)}
.view .ax.on{color:var(--ink);background:rgba(var(--accent-rgb),.16);border-color:rgba(var(--accent-rgb),.55)}
.view .ax.on:hover:not(:disabled){background:rgba(var(--accent-rgb),.24);border-color:rgba(var(--accent-rgb),.7)}
.ax.on i{opacity:1;color:var(--coral);transform:rotate(180deg)}

/* Звук: кнопка «прослухати» поруч із перемикачем */
.pair{display:flex;align-items:center;gap:10px;flex:none}
.view .mini{width:34px;height:34px;padding:0;display:grid;place-items:center;border-radius:50%}
.mini svg,.acts svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
/* Дані: три дії в ряд */
.acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px 14px 14px;border-top:1px solid var(--hair)}
.view .acts button{display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 8px;white-space:nowrap}
.view .acts .danger{color:#ff8a7e;border-color:rgba(240,58,46,.3);background:rgba(240,58,46,.07)}
.view .acts .danger:hover:not(:disabled){background:rgba(240,58,46,.15);border-color:rgba(240,58,46,.5)}
.note.err{color:#ff7a6e}
.acts+.note{border-top:1px solid var(--hair)}

/* Про систему: пари «назва — значення» */
.kv{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);border-top:1px solid var(--hair)}
.kv dt,.kv dd{margin:0;padding:10px 14px;font-size:12.5px;border-bottom:1px solid var(--hair)}
.kv dt{color:var(--dim)}
.kv dd{text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kv dd.mono{font:12px var(--mono)}
.kv dd.dim{color:var(--dim)}
.note{margin:0;padding:12px 14px;color:var(--dim);font-size:11.5px;line-height:1.45}

/* Перемикання вкладок: короткий наплив */
.stab-enter-active{transition:opacity var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.stab-leave-active{transition:opacity .12s var(--ease-out)}
.stab-enter-from{opacity:0;transform:translateY(8px)}
.stab-leave-to{opacity:0}

@media(max-width:560px){
  .srow.wr{flex-wrap:wrap}
  .srow.wr>:last-child{margin-left:auto}
  .view .acts button{padding:10px 4px;font-size:11.5px}
  h1{font-size:17px}
  .tic{width:38px;height:38px}
}
</style>

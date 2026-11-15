<script setup>
// Сторінка «Дизайн» у налаштуваннях: акцентний колір (пресети або свій), скло, форма, масштаб, фон.
// Кожна зміна одразу застосовується до всього інтерфейсу (живий перегляд) і зберігається — див. stores/designStore.js.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useDesignStore } from '../../stores/designStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'
import { PRESETS, LIMITS, UPSCALE_MIN_WIDTH } from '../../services/theme'
import ColorPicker from '../ui/ColorPicker.vue'

const design = useDesignStore()
const { confirm } = useConfirm()
const { t } = useI18n()
const d = design.d

const custom = ref(d.preset === 'custom')
const pickPreset = id => { custom.value = false; design.setPreset(id) }

/** Повзунки: ключ, одиниця, крок; масштаб застосовується після відпускання (інакше інтерфейс «пливе» під пальцем) */
const GROUPS = [
  { id: 'glass', items: [{ k: 'glass', u: '%', step: 5 }, { k: 'blur', u: 'px', step: 1 }] },
  { id: 'shape', items: [{ k: 'radius', u: '%', step: 5 }, { k: 'scale', u: '%', step: 5, lazy: true }] },
  { id: 'bg', items: [{ k: 'grid', u: '%', step: 10 }, { k: 'glow', u: '%', step: 10 }] }
]
const draft = ref({})
const shown = k => draft.value[k] ?? d[k]
function onInput(it, v) {
  if (it.lazy) draft.value = { ...draft.value, [it.k]: Number(v) }
  else design.set(it.k, Number(v))
}
function onChange(it, v) {
  if (!it.lazy) return
  design.set(it.k, Number(v))
  const { [it.k]: _, ...rest } = draft.value
  draft.value = rest
}
/** Вікно вужче за UPSCALE_MIN_WIDTH: збільшення не діє (див. services/theme.js) */
const narrow = ref(innerWidth < UPSCALE_MIN_WIDTH)
const onResize = () => { narrow.value = innerWidth < UPSCALE_MIN_WIDTH }
onMounted(() => addEventListener('resize', onResize))
onBeforeUnmount(() => removeEventListener('resize', onResize))
const pct = it => ((shown(it.k) - LIMITS[it.k][0]) / (LIMITS[it.k][1] - LIMITS[it.k][0])) * 100

/** Кільце «3D-вази» мініекрана: еліпс у перспективі; профіль — широке дно, вузька шийка, розтруб */
function vaseRing(i) {
  const k = i / 26, cy = 138 - i * 4.6, rx = 26 + 15 * Math.cos(k * Math.PI * 1.9), ry = rx * 0.2
  return `M${60 - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`
}

const SYNC = { local: 'design.syncLocal', saving: 'design.syncSaving', synced: 'design.syncOk', error: 'design.syncErr' }
const syncText = computed(() => t(SYNC[design.sync] || SYNC.local))

async function reset() {
  if (await confirm('design.resetConfirm', { okKey: 'design.reset' })) { custom.value = false; draft.value = {}; design.reset() }
}
</script>

<template>
  <div class="dz">
    <div class="col">
    <!-- ---------- акцент ---------- -->
    <section class="blk">
      <header><b>{{ t('design.accent') }}<span class="cur"> · {{ t('design.p.' + d.preset) }}</span></b><small>{{ t('design.accentHint') }}</small></header>
      <div class="sws" role="radiogroup" :aria-label="t('design.accent')">
        <button v-for="p in PRESETS" :key="p.id" type="button" role="radio" class="sw" :class="{ on: d.preset === p.id }" :aria-checked="String(d.preset === p.id)"
                :style="{ '--a': p.accent, '--b': p.brand }" :title="t('design.p.' + p.id)" :aria-label="t('design.p.' + p.id)" @click="pickPreset(p.id)">
          <span class="dot"><svg v-if="d.preset === p.id" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" /></svg></span>
          <small>{{ t('design.p.' + p.id) }}</small>
        </button>
        <button type="button" role="radio" class="sw cust" :class="{ on: d.preset === 'custom', open: custom && d.preset !== 'custom' }" :aria-checked="String(d.preset === 'custom')"
                :style="d.preset === 'custom' ? { '--a': d.accent, '--b': d.brand } : null" :aria-expanded="String(custom)" @click="custom = !custom">
          <span class="dot"><svg v-if="d.preset === 'custom'" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" /></svg></span>
          <small>{{ t('design.p.custom') }}</small>
        </button>
      </div>
      <Transition name="pk">
        <div v-if="custom" class="pick">
          <ColorPicker :model-value="d.accent" @update:model-value="design.setAccent($event)" />
        </div>
      </Transition>
    </section>

    <!-- ---------- повзунки: «Фон» — ліворуч під кольором, решта — праворуч ---------- -->
    <section v-for="g in GROUPS.filter(x => x.id === 'bg')" :key="g.id" class="blk">
      <header><b>{{ t('design.g.' + g.id) }}</b></header>
      <label v-for="it in g.items" :key="it.k" class="rng">
        <span class="lb">{{ t('design.' + it.k) }}<small>{{ t('design.' + it.k + 'Hint') }}</small></span>
        <output>{{ shown(it.k) }}<i>{{ it.u }}</i><em v-if="it.k === 'scale' && shown('scale') > 100 && narrow">{{ t('design.scaleNarrow') }}</em></output>
        <input type="range" :min="LIMITS[it.k][0]" :max="LIMITS[it.k][1]" :step="it.step" :value="shown(it.k)" :style="{ '--p': pct(it) + '%' }"
               :aria-label="t('design.' + it.k)" @input="onInput(it, $event.target.value)" @change="onChange(it, $event.target.value)">
      </label>
    </section>
    </div>
    <div class="col">
    <section v-for="g in GROUPS.filter(x => x.id !== 'bg')" :key="g.id" class="blk">
      <header><b>{{ t('design.g.' + g.id) }}</b></header>
      <label v-for="it in g.items" :key="it.k" class="rng">
        <span class="lb">{{ t('design.' + it.k) }}<small>{{ t('design.' + it.k + 'Hint') }}</small></span>
        <output>{{ shown(it.k) }}<i>{{ it.u }}</i></output>
        <input type="range" :min="LIMITS[it.k][0]" :max="LIMITS[it.k][1]" :step="it.step" :value="shown(it.k)" :style="{ '--p': pct(it) + '%' }"
               :aria-label="t('design.' + it.k)" @input="onInput(it, $event.target.value)" @change="onChange(it, $event.target.value)">
      </label>
    </section>

    </div>

    <!-- ---------- живий мініекран: той самий інтерфейс у мініатюрі, реагує на всі повзунки ---------- -->
    <div class="col pcol">
      <section class="blk prev">
        <header><b>{{ t('design.preview') }}</b><small>{{ t('design.previewHint') }}</small></header>
        <div class="scr" aria-hidden="true">
          <div class="s-grid"></div>
          <div class="s-glow"></div>
          <!-- «3D-модель»: ваза з надрукованою частиною в кольорах теми -->
          <svg class="s-vase" viewBox="0 0 120 150">
            <defs>
              <linearGradient id="dzPrinted" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" :style="{ stopColor: d.brand }" /><stop offset="1" :style="{ stopColor: d.accent }" />
              </linearGradient>
              <radialGradient id="dzHalo"><stop offset="0" :style="{ stopColor: d.accent, stopOpacity: .55 }" /><stop offset="1" :style="{ stopColor: d.accent, stopOpacity: 0 }" /></radialGradient>
            </defs>
            <ellipse cx="60" cy="84" rx="48" ry="14" fill="url(#dzHalo)" />
            <path v-for="i in 26" :key="i" :d="vaseRing(i)" fill="none" :stroke="i <= 14 ? 'url(#dzPrinted)' : '#4a4f57'" :stroke-opacity="i <= 14 ? 1 : .7" stroke-width=".9" />
            <path :d="vaseRing(14)" fill="none" stroke="#fff" stroke-width="1.2" />
          </svg>
          <div class="s-hd">
            <span class="s-logo"><i></i>VORON</span>
            <span class="s-isl"><i></i>{{ t('state.printing') }}</span>
            <span class="s-sp"></span>
            <span class="s-tabs"><b>{{ t('nav.main') }}</b><span>{{ t('nav.console') }}</span><span>{{ t('nav.hist') }}</span></span>
            <span class="s-sp"></span>
            <span class="s-stop">STOP</span>
          </div>
          <div class="s-panel">
            <p><span>{{ t('status.nozzle') }}</span><b class="hot">205°</b></p>
            <p><span>{{ t('status.bed') }}</span><b class="hot">110°</b></p>
            <p><span>{{ t('status.speed') }}</span><b>100%</b></p>
            <p class="s-btns"><span class="s-btn">{{ t('print.resume') }}</span><span class="s-ghost">{{ t('print.cancel') }}</span></p>
          </div>
          <div class="s-pct">42<i>%</i></div>
          <div class="s-tools"><span class="on">T0</span><span>T1</span><span>T2</span></div>
          <div class="s-bar"><i></i></div>
        </div>
      </section>

      <footer class="blk ft">
        <span class="sync" :class="'s-' + design.sync"><i></i>{{ syncText }}</span>
        <button type="button" class="rst" @click="reset">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5" /></svg>{{ t('design.reset') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dz{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr);gap:14px;align-items:start}
@media(max-width:1280px){.dz{grid-template-columns:repeat(2,minmax(0,1fr))}.pcol{grid-column:1/-1;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:start}}
.col{display:grid;gap:12px;min-width:0}
.blk{display:grid;gap:14px;padding:14px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--r-lg)}
.blk header{display:grid;gap:3px}
.blk header b{font-size:13px;font-weight:600}
.blk header small{color:var(--dim);font-size:11.5px;line-height:1.4}

/* ---------- пресети ---------- */
/* Рівно 5 в ряд: 9 пресетів + «Свій» = два повні ряди на будь-якій ширині */
.sws{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.view .sw{display:grid;justify-items:center;gap:6px;padding:10px 4px 8px;background:transparent;border:1px solid transparent;border-radius:var(--r-md)}
.view .sw:hover:not(:disabled){background:rgba(255,255,255,.05);border-color:var(--hair)}
.view .sw.open{border-color:var(--hair)}
.view .sw.on{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12)}
.sw .dot{position:relative;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,var(--a),var(--b));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 4px 14px -6px var(--b);transition:transform var(--t-spring) var(--spring),box-shadow var(--t-mid) var(--ease-out)}
.sw.on .dot{box-shadow:0 0 0 2px #151517,0 0 0 4px var(--a),0 6px 18px -6px var(--b)}
.sw:active .dot{transform:scale(.9)}
.sw .dot svg{width:15px;height:15px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}
.sw small{font-size:10.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.sw.on small{color:var(--ink)}
/* «Свій»: веселкове коло, доки не вибрано власний колір */
.cust .dot{background:conic-gradient(from 200deg,#ff5a5a,#ffd25a,#5fe08a,#5cd6ff,#7c6bff,#ff7cb4,#ff5a5a)}
.cust[style] .dot{background:linear-gradient(145deg,var(--a),var(--b))}
.pick{padding:12px;border-radius:var(--r-md);background:rgba(0,0,0,.22);border:1px solid var(--hair)}
.pk-enter-active{transition:opacity var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.pk-leave-active{transition:opacity .14s var(--ease-out)}
.pk-enter-from{opacity:0;transform:translateY(-6px) scale(.98)}
.pk-leave-to{opacity:0}

/* ---------- повзунки ---------- */
.rng{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px 12px;cursor:default}
.rng+.rng{padding-top:12px;border-top:1px solid var(--hair)}
.lb{display:grid;gap:2px;font-size:13px}
.lb small{color:var(--dim);font-size:11px}
output{font-size:13px;font-weight:500;min-width:52px;text-align:right}
output em{display:block;font-style:normal;font-weight:400;font-size:10.5px;color:#ff9f0a}
output i{font-style:normal;color:var(--dim);margin-left:2px;font-size:11px}
.view .rng input[type=range]{grid-column:1/-1;-webkit-appearance:none;appearance:none;width:100%;height:6px;padding:0;margin:4px 0;border:0;border-radius:999px;cursor:pointer;
  background:linear-gradient(90deg,var(--coral) 0,var(--coral) var(--p),rgba(255,255,255,.1) var(--p));box-shadow:inset 0 1px 2px rgba(0,0,0,.35)}
.view .rng input[type=range]:focus{box-shadow:var(--ring)}
.rng input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:0;box-shadow:0 2px 8px rgba(0,0,0,.45);
  transition:transform var(--t-spring) var(--spring)}
.rng input[type=range]:active::-webkit-slider-thumb{transform:scale(1.15)}
.rng input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:0;box-shadow:0 2px 8px rgba(0,0,0,.45)}

/* ---------- живий мініекран ---------- */
.scr{position:relative;aspect-ratio:16/11;border-radius:var(--r-md);overflow:hidden;background:#0a0a0b;border:1px solid rgba(255,255,255,.07);
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.4),0 18px 40px -22px rgba(0,0,0,.9);font-size:8px;color:var(--ink);container-type:inline-size}
.scr>*{position:absolute}
.s-grid{inset:0;opacity:var(--grid-k,1);background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='48.5' viewBox='0 0 56 97'%3E%3Cpath d='M28 0 56 16.17V48.5L28 64.67 0 48.5V16.17ZM28 64.67V97' fill='none' stroke='%23ffffff' stroke-opacity='.08' stroke-width='1.6'/%3E%3C/svg%3E")}
.s-glow{inset:0;background:radial-gradient(ellipse 70% 60% at 8% 108%,rgba(var(--brand-rgb),calc(.32 * var(--glow-k,1))),transparent 70%),radial-gradient(ellipse 50% 40% at 100% -5%,rgba(var(--brand-rgb),calc(.12 * var(--glow-k,1))),transparent 70%)}
.s-vase{left:50%;top:12%;height:74%;transform:translateX(-50%)}
/* шапка */
.s-hd{left:4%;right:4%;top:5%;display:flex;align-items:center;gap:4%;font-size:clamp(6px,2.1cqw,10px)}
.s-sp{flex:1}
.s-logo{display:flex;align-items:center;gap:.6em;font-weight:600;letter-spacing:.15em;color:var(--brand)}
.s-logo i{width:1.5em;height:1.5em;border-radius:.4em;background:var(--red)}
.s-isl{display:flex;align-items:center;gap:.6em;padding:.45em .9em;border-radius:999px;background:#050506;border:1px solid rgba(255,255,255,.08)}
.s-isl i{width:.7em;height:.7em;border-radius:50%;background:var(--coral);box-shadow:0 0 .8em rgba(var(--accent-rgb),.9)}
.s-tabs{display:flex;gap:.2em;padding:.25em;border-radius:999px;background:rgba(20,20,22,calc(1 - .35 * var(--glass-t,1)));border:1px solid rgba(255,255,255,.07);color:var(--dim)}
.s-tabs>*{padding:.45em .9em;border-radius:999px}
.s-tabs b{position:relative;font-weight:500;color:var(--ink);background:linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.06));box-shadow:0 .6em 1.4em -.8em rgba(var(--brand-rgb),.8)}
.s-tabs b::after{content:'';position:absolute;left:50%;bottom:0;width:1.2em;height:.18em;margin-left:-.6em;border-radius:1em;background:var(--brand);box-shadow:0 0 .6em rgba(var(--brand-rgb),.9)}
.s-stop{padding:.5em 1em;border-radius:999px;font-weight:700;color:#fff;background:linear-gradient(180deg,#ff5a4c,#e0321f);box-shadow:0 0 1.2em -.2em rgba(240,58,46,.8)}
/* скляна панель статусу — справжнє скло: прозорість і розмиття з теми */
.s-panel{right:4%;top:19%;width:34%;padding:.4em .9em;border-radius:var(--r-md);font-size:clamp(6px,2cqw,10px);
  background:rgba(20,20,22,calc(1 - .35 * var(--glass-t,1)));-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);
  border:1px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);box-shadow:var(--glass-shadow)}
.s-panel p{margin:0;display:flex;justify-content:space-between;padding:.55em 0}
.s-panel p+p{border-top:1px solid rgba(255,255,255,.06)}
.s-panel span{color:var(--dim)}
.s-panel .hot{color:#ff8a6e;font-weight:400}
.s-panel b{font-weight:400}
.view .s-panel .s-btns{gap:.5em;padding-top:.8em}
.s-btn,.s-ghost{flex:1;text-align:center;padding:.6em .4em;border-radius:var(--r-sm);font-weight:600}
.s-panel .s-btn{color:var(--on-btn);background:linear-gradient(180deg,var(--btn-hi),var(--btn-lo));box-shadow:0 .4em 1em -.5em rgba(var(--brand-rgb),.9)}
.s-panel .s-ghost{color:#ff8a7e;background:rgba(240,58,46,.08);border:1px solid rgba(240,58,46,.35)}
.s-pct{left:4%;bottom:9%;font-size:clamp(20px,9cqw,46px);font-weight:200;line-height:1;letter-spacing:-.04em}
.s-pct i{font-style:normal;font-size:.32em;color:var(--brand);margin-left:.15em;text-shadow:0 0 .6em rgba(var(--brand-rgb),.6)}
.s-tools{left:50%;bottom:8%;transform:translateX(-50%);display:flex;gap:.5em;padding:.4em;border-radius:var(--r-md);font-size:clamp(6px,2cqw,10px);
  background:rgba(20,20,22,calc(1 - .35 * var(--glass-t,1)));-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);border:1px solid rgba(255,255,255,.07)}
.s-tools span{padding:.6em 1.1em;border-radius:var(--r-sm);font-weight:600;color:var(--dim)}
.s-tools .on{color:var(--ink);border:1px solid rgba(var(--brand-rgb),.6);background:rgba(var(--brand-rgb),.12)}
.s-bar{left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.06)}
.s-bar i{display:block;width:42%;height:100%;background:var(--brand);box-shadow:0 0 8px rgba(var(--brand-rgb),.9)}

/* ---------- низ: стан збереження і скидання ---------- */
.ft{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 10px 10px 14px}
.sync{display:inline-flex;align-items:center;gap:8px;color:var(--dim);font-size:12px;min-width:0}
.sync i{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dim)}
.s-synced i{background:#34c759;box-shadow:0 0 7px rgba(52,199,89,.7)}
.s-saving i{background:#ff9f0a;animation:dz-blink 1s cubic-bezier(.45,0,.55,1) infinite}
.s-error i{background:var(--red)}
@keyframes dz-blink{50%{opacity:.3}}
.view .rst{display:inline-flex;align-items:center;gap:7px}
.rst svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}

/* Назва вибраного пресета в заголовку — лише на телефоні, де підписи під кружечками сховані */
.cur{display:none;color:var(--coral);font-weight:500}
@media(max-width:480px){
  .sw small{display:none}
  .cur{display:inline}
  .view .sw{padding:8px 2px}
}
@media(max-width:820px){
  .dz{grid-template-columns:minmax(0,1fr)}
  .pcol{grid-template-columns:minmax(0,1fr)}
}
</style>

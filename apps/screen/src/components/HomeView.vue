<script setup>
// Головний екран у стилі Vyron: «скляні» картки, кільце прогресу з градієнтом фірмового кольору,
// температури з іконками, унизу — дії друку або док розділів (як в iOS).
import { computed } from 'vue'
import { fmtDuration } from '@vyron/shared/format'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from './Icon.vue'

const emit = defineEmits(['cancel'])
const p = usePrinter()

// Кільце прогресу: SVG-обведення (дешево для слабкої графіки), радіус 44 у сітці 100×100
const C = 2 * Math.PI * 44
const dash = computed(() => C * (1 - p.progress))
const pct = computed(() => Math.floor(p.progress * 100))
const file = computed(() => String((p.st.print_stats || {}).filename || '').replace(/\.gcode$/i, ''))
const left = computed(() => (p.remaining == null ? '' : fmtDuration(p.remaining, t)))
const temp = v => (v == null ? '–' : Math.round(v))
const hot = h => h.target > 0

const DOCK = [
  { id: 'files', icon: 'files', soon: true },
  { id: 'move', icon: 'move', soon: true },
  { id: 'temp', icon: 'flame', soon: true },
  { id: 'settings', icon: 'gear' }
]
function open(d) { if (!d.soon) p.go(d.id) }
</script>

<template>
  <div class="home page">
    <section class="hero glass">
      <template v-if="p.active">
        <div class="ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" style="stop-color:var(--coral)" />
                <stop offset="1" style="stop-color:var(--brand)" />
              </linearGradient>
            </defs>
            <circle class="track" cx="50" cy="50" r="44" />
            <circle class="halo" cx="50" cy="50" r="44" :stroke-dasharray="C" :stroke-dashoffset="dash" />
            <circle class="bar" cx="50" cy="50" r="44" :stroke-dasharray="C" :stroke-dashoffset="dash" />
          </svg>
          <div class="pct"><b>{{ pct }}</b><small>%</small></div>
        </div>
        <div class="meta">
          <span class="file">{{ file }}</span>
          <span class="chips">
            <span v-if="p.layer" class="chip">{{ t('scr.layer', p.layer) }}</span>
            <span v-if="left" class="chip">{{ left }}</span>
          </span>
        </div>
      </template>
      <div v-else class="idle">
        <small>{{ t('scr.hello') }}</small>
        <b>{{ t('scr.idle') }}</b>
        <span>{{ t('scr.idleHint') }}</span>
      </div>
    </section>

    <section class="temps">
      <div v-for="h in p.heaters" :key="h.id" class="tile glass" :class="{ hot: hot(h) }">
        <span class="ti"><Icon :name="h.icon" size="1.7rem" /></span>
        <span class="tx">
          <span class="lbl">{{ t(h.key) }}</span>
          <span class="now">{{ temp(h.temperature) }}<i>°</i></span>
        </span>
        <span v-if="h.target !== undefined" class="tgt">{{ hot(h) ? temp(h.target) + '°' : t('qs.off') }}</span>
      </div>
    </section>

    <footer v-if="p.active" class="acts">
      <button v-if="p.printState === 'printing'" type="button" class="btn glass tap" :disabled="!!p.busy" @click="p.pause()">
        <Icon name="pause" size="1.7rem" :stroke="2.6" />{{ t('print.pause') }}
      </button>
      <button v-else type="button" class="btn main tap" :disabled="!!p.busy" @click="p.resume()">
        <Icon name="play" size="1.6rem" :stroke="2.4" />{{ t('print.resume') }}
      </button>
      <button type="button" class="btn glass danger tap" :disabled="!!p.busy" @click="emit('cancel')">
        <Icon name="stop" size="1.5rem" :stroke="2.4" />{{ t('print.cancel') }}
      </button>
      <button type="button" class="btn glass sq tap" :aria-label="t('scr.page.settings')" @click="p.go('settings')"><Icon name="gear" size="2rem" /></button>
    </footer>
    <nav v-else class="dock glass">
      <button v-for="d in DOCK" :key="d.id" type="button" class="dk tap" :class="{ soon: d.soon }" @click="open(d)">
        <span class="di" :class="'c-' + d.id"><Icon :name="d.icon" size="1.9rem" /></span>
        <span class="dl">{{ t('scr.page.' + d.id) }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.home{display:grid;grid-template-columns:1fr 16.5rem;grid-template-rows:1fr auto;gap:.9rem;padding:.2rem 1.2rem 1.2rem}
.hero{min-width:0;border-radius:var(--r-lg);display:flex;align-items:center;gap:1.3rem;padding:1rem 1.4rem 1rem 1rem}

.ring{position:relative;flex:none;width:12.4rem;height:12.4rem}
.ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.track{fill:none;stroke:rgba(255,255,255,.07);stroke-width:7}
.halo{fill:none;stroke:var(--coral);stroke-width:13;stroke-linecap:round;opacity:.13;transition:stroke-dashoffset 1s linear}
.bar{fill:none;stroke:url(#rg);stroke-width:7;stroke-linecap:round;transition:stroke-dashoffset 1s linear}
.pct{position:absolute;inset:0;display:flex;align-items:baseline;justify-content:center;padding-top:3.9rem}
.pct b{font-size:3.8rem;font-weight:700;letter-spacing:-.05em;line-height:1}
.pct small{font-size:1.5rem;font-weight:600;color:var(--dim);margin-left:.15rem}

.meta{min-width:0;display:grid;gap:.9rem}
.file{font-size:1.45rem;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.chips{display:flex;flex-wrap:wrap;gap:.5rem}
.chip{padding:.35rem .8rem;border-radius:1rem;background:rgba(255,255,255,.08);font-size:1.15rem;font-weight:500;color:#d1d1d6;white-space:nowrap}

.idle{display:grid;gap:.5rem;padding-left:.6rem}
.idle small{font-size:1.2rem;font-weight:600;color:var(--coral);text-transform:uppercase;letter-spacing:.08em}
.idle b{font-size:2.6rem;font-weight:700;letter-spacing:-.03em;line-height:1.1}
.idle span{font-size:1.25rem;color:var(--dim);line-height:1.4}

.temps{display:grid;gap:.7rem;align-content:stretch;grid-auto-rows:1fr}
.tile{position:relative;display:flex;align-items:center;gap:.9rem;padding:.6rem 1rem;border-radius:var(--r)}
.ti{flex:none;width:3rem;height:3rem;border-radius:.9rem;display:grid;place-items:center;background:rgba(255,255,255,.08);color:var(--dim)}
.tx{display:grid;gap:.05rem;min-width:0}
.lbl{font-size:1.1rem;color:var(--dim);font-weight:500}
.now{font-size:2.2rem;font-weight:600;line-height:1.05;letter-spacing:-.03em}
.now i{font-style:normal;font-weight:400;color:var(--dim)}
.tgt{position:absolute;top:.7rem;right:1rem;font-size:1.05rem;color:var(--dim)}
.hot .ti{background:rgba(var(--accent-rgb),.18);color:var(--coral)}
.hot .now{color:var(--coral)}

.acts{grid-column:1 / -1;display:flex;gap:.8rem}
.btn{flex:1;height:5rem;border-radius:var(--r);display:flex;align-items:center;justify-content:center;gap:.7rem;font-size:1.5rem;font-weight:600}
.btn.sq{flex:none;width:5rem}
.btn.main{background:linear-gradient(180deg,var(--btn-hi),var(--btn-lo));color:var(--on-btn);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.btn.danger{color:var(--red)}

.dock{grid-column:1 / -1;display:flex;gap:.4rem;padding:.5rem;border-radius:var(--r-lg)}
.dk{flex:1;height:4.6rem;border-radius:var(--r);display:flex;align-items:center;justify-content:center;gap:.8rem;font-size:1.3rem;font-weight:600}
.di{width:3rem;height:3rem;border-radius:.85rem;display:grid;place-items:center;color:#fff}
.c-files{background:linear-gradient(180deg,#5ac8fa,#0a84ff)}
.c-move{background:linear-gradient(180deg,#a78bfa,#7c3aed)}
.c-temp{background:linear-gradient(180deg,#ffb340,#ff6b2c)}
.c-settings{background:linear-gradient(180deg,#9a9aa0,#636366)}
.dk.soon{opacity:.5}
</style>

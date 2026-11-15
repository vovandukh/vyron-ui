<script setup>
// Головний екран: прогрес друку (або «готовий») ліворуч, температури праворуч, великі дії внизу.
import { computed } from 'vue'
import { fmtDuration } from '@vyron/shared/format'
import { usePrinter } from '../store'
import { t } from '../i18n'

const emit = defineEmits(['cancel'])
const p = usePrinter()

// Кільце прогресу: SVG-обведення (дешево для слабкої графіки), радіус 44 у сітці 100×100
const C = 2 * Math.PI * 44
const dash = computed(() => C * (1 - p.progress))
const pct = computed(() => Math.floor(p.progress * 100))
const file = computed(() => String((p.st.print_stats || {}).filename || '').replace(/\.gcode$/i, ''))
const left = computed(() => (p.remaining == null ? '' : t('eta.left', { t: fmtDuration(p.remaining, t) })))
const temp = v => (v == null ? '–' : Math.round(v) + '°')
const hot = h => h.target > 0
</script>

<template>
  <main class="home">
    <section class="job">
      <template v-if="p.active">
        <div class="ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="track" cx="50" cy="50" r="44" />
            <circle class="bar" cx="50" cy="50" r="44" :stroke-dasharray="C" :stroke-dashoffset="dash" />
          </svg>
          <b class="pct">{{ pct }}<small>%</small></b>
        </div>
        <div class="meta">
          <span class="file">{{ file }}</span>
          <span v-if="p.layer" class="sub">{{ t('scr.layer', p.layer) }}</span>
          <span v-if="left" class="sub">{{ left }}</span>
        </div>
      </template>
      <div v-else class="idle">
        <b>{{ t('scr.idle') }}</b>
        <span>{{ t('scr.idleHint') }}</span>
      </div>
    </section>

    <section class="temps">
      <div v-for="h in p.heaters" :key="h.id" class="tile" :class="{ hot: hot(h) }">
        <span class="lbl">{{ t(h.key) }}</span>
        <b class="now">{{ temp(h.temperature) }}</b>
        <span v-if="h.target !== undefined" class="tgt">{{ hot(h) ? '→ ' + temp(h.target) : t('qs.off') }}</span>
      </div>
    </section>

    <footer class="acts">
      <template v-if="p.active">
        <button v-if="p.printState === 'printing'" type="button" class="btn tap" :disabled="!!p.busy" @click="p.pause()">{{ t('print.pause') }}</button>
        <button v-else type="button" class="btn main tap" :disabled="!!p.busy" @click="p.resume()">{{ t('print.resume') }}</button>
        <button type="button" class="btn danger tap" :disabled="!!p.busy" @click="emit('cancel')">{{ t('print.cancel') }}</button>
      </template>
      <template v-else>
        <button v-for="k in ['files', 'move', 'temp', 'more']" :key="k" type="button" class="btn nav" disabled>
          {{ t('scr.' + k) }}<small>{{ t('scr.soon') }}</small>
        </button>
      </template>
    </footer>
  </main>
</template>

<style scoped>
.home{height:calc(100% - 4.6rem);display:grid;grid-template-columns:1fr 17rem;grid-template-rows:1fr auto;gap:1rem;padding:1rem 1.2rem 1.2rem}
.job{min-width:0;display:flex;align-items:center;gap:1.4rem}
.ring{position:relative;flex:none;width:13rem;height:13rem}
.ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.track{fill:none;stroke:var(--panel-hi);stroke-width:7}
.bar{fill:none;stroke:var(--coral);stroke-width:7;stroke-linecap:round;transition:stroke-dashoffset 1s linear}
.pct{position:absolute;inset:0;display:grid;place-items:center;font-size:3.6rem;font-weight:700;letter-spacing:-.03em}
.pct small{font-size:1.6rem;font-weight:600;color:var(--dim);margin-left:.1rem}
.pct{grid-auto-flow:column;align-content:center;justify-content:center;align-items:baseline}
.meta{min-width:0;display:grid;gap:.5rem}
.file{font-size:1.5rem;font-weight:600;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.sub{font-size:1.3rem;color:var(--dim)}
.idle{display:grid;gap:.6rem}
.idle b{font-size:2.4rem;font-weight:700;letter-spacing:-.01em}
.idle span{font-size:1.3rem;color:var(--dim);line-height:1.4}

.temps{display:grid;gap:.8rem;align-content:center}
.tile{display:grid;grid-template-columns:1fr auto;grid-template-areas:"lbl tgt" "now now";align-items:baseline;gap:.1rem .6rem;padding:.8rem 1.1rem;border-radius:var(--r);background:var(--panel);border:1px solid var(--line)}
.lbl{grid-area:lbl;font-size:1.2rem;color:var(--dim)}
.tgt{grid-area:tgt;font-size:1.15rem;color:var(--dim)}
.now{grid-area:now;font-size:2.4rem;font-weight:600;line-height:1.1}
.hot .now{color:var(--coral)}

.acts{grid-column:1 / -1;display:flex;gap:.8rem}
.btn{flex:1;height:5.2rem;border-radius:var(--r);background:var(--panel-hi);border:1px solid var(--line);font-size:1.6rem;font-weight:600;display:grid;place-content:center;justify-items:center;gap:.1rem}
.btn.main{background:linear-gradient(180deg,var(--btn-hi),var(--btn-lo));color:var(--on-btn);border-color:transparent}
.btn.danger{color:var(--red)}
.btn.nav{font-size:1.4rem}
.btn small{font-size:1rem;font-weight:500;color:var(--dim)}
.btn.nav:disabled{opacity:.55}
</style>

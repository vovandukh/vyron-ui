<script setup>
// Головний екран у стилі Vyron: «скляні» картки, кільце прогресу з градієнтом фірмового кольору,
// температури з іконками, унизу — дії друку або док розділів (як в iOS).
import { computed } from 'vue'
import { fmtDuration } from '@vyron/shared/format'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from './Icon.vue'
import GcodeView from './GcodeView.vue'

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
/** Модель показуємо, коли G-code розібрано; інакше (завантаження, завеликий файл) — кільце прогресу */
const showModel = computed(() => p.showModel && p.gcodeState === 'ready')
const pctShown = computed(() => (p.printState === 'complete' ? 100 : pct.value))

const DOCK = [
  { id: 'files', icon: 'files', soon: true },
  { id: 'move', icon: 'move' },
  { id: 'temp', icon: 'flame', soon: true },
  { id: 'settings', icon: 'gear' }
]
function open(d) { if (!d.soon) p.go(d.id) }
</script>

<template>
  <div class="home page">
    <section class="hero glass" :class="{ model: showModel }">
      <!-- Модель друку (G-code) на всю картку; поверх — відсоток, файл і час. Під моделлю — легка шестикутна сітка (статична, малюється раз). -->
      <template v-if="showModel">
        <GcodeView />
        <div class="ov-top"><b>{{ pctShown }}</b><small>%</small><span v-if="p.printState === 'complete'" class="done">{{ t('state.complete') }}</span></div>
        <div class="ov-bot">
          <span class="file one">{{ file }}</span>
          <span class="chips">
            <span v-if="p.layer" class="chip">{{ t('scr.layer', p.layer) }}</span>
            <span v-if="left" class="chip">{{ left }}</span>
          </span>
        </div>
      </template>
      <template v-else-if="p.active">
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
        <!-- Швидкі дії перед друком: Home, вирівнювання порталу, вимкнення моторів -->
        <span class="quick">
          <button type="button" class="q tap" :disabled="!!p.moving" @click="p.homeAll()">
            <Icon name="home" size="1.6rem" />{{ t('jog.homeAll') }}<i v-if="p.moving === 'home'" class="spin"></i>
          </button>
          <button v-if="p.leveling" type="button" class="q tap" :disabled="!!p.moving" @click="p.level()">
            <Icon name="level" size="1.6rem" />{{ p.leveling.kind === 'ztilt' ? 'Z-Tilt' : 'QGL' }}
            <i v-if="p.moving === 'level'" class="spin"></i>
            <Icon v-else-if="p.leveled" name="check" size="1.4rem" :stroke="2.8" class="ok" />
          </button>
          <button type="button" class="q tap" :disabled="!!p.moving" :aria-label="t('jog.motorsOffAria')" @click="p.motorsOff()">
            <Icon name="motors" size="1.6rem" />
          </button>
        </span>
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
        <span class="di"><Icon :name="d.icon" size="1.9rem" /></span>
        <span class="dl">{{ t('scr.page.' + d.id) }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.home{display:grid;grid-template-columns:1fr 16.5rem;grid-template-rows:1fr auto;gap:.9rem;padding:.2rem 1.2rem 1.2rem}
.hero{position:relative;min-width:0;border-radius:var(--r-lg);display:flex;align-items:center;gap:1.3rem;padding:1rem 1.4rem 1rem 1rem;overflow:hidden}
.hero.model{padding:0}
/* Шестикутна сітка Vyron під моделлю: статичний SVG-візерунок, яскравіший у центрі й згасає до країв */
.hero.model::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.9;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='48' viewBox='0 0 28 48'%3E%3Cpath d='M14 0 28 8v16L14 32 0 24V8zM14 32v16' fill='none' stroke='%23ffffff' stroke-opacity='.11' stroke-width='1'/%3E%3C/svg%3E") center / 2.8rem 4.8rem;
  -webkit-mask-image:radial-gradient(ellipse 62% 66% at 50% 48%,#000 25%,transparent 100%);mask-image:radial-gradient(ellipse 62% 66% at 50% 48%,#000 25%,transparent 100%)}
/* Підписи поверх моделі: темні градієнти зверху й знизу, щоб текст читався на будь-якому фоні */
.ov-top{position:absolute;left:0;top:0;right:0;padding:.8rem 1.2rem 2rem;display:flex;align-items:baseline;pointer-events:none;background:linear-gradient(180deg,rgba(6,6,7,.7),transparent)}
.ov-top b{font-size:3rem;font-weight:700;letter-spacing:-.05em;line-height:1}
.ov-top .done{margin-left:.8rem;padding:.25rem .7rem;border-radius:1rem;background:rgba(48,209,88,.16);color:var(--green);font-size:1.1rem;font-weight:600;align-self:center}
.ov-top small{font-size:1.3rem;font-weight:600;color:var(--dim);margin-left:.15rem}
.ov-bot{position:absolute;left:0;right:0;bottom:0;padding:2.2rem 1.2rem .9rem;display:grid;gap:.5rem;pointer-events:none;background:linear-gradient(0deg,rgba(6,6,7,.85),transparent)}
.file.one{-webkit-line-clamp:1;font-size:1.3rem}

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
.idle small{font-size:1.15rem;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}
.idle b{font-size:2.6rem;font-weight:700;letter-spacing:-.03em;line-height:1.1}
.idle > span{font-size:1.25rem;color:var(--dim);line-height:1.4}
.quick{display:flex;gap:.5rem;margin-top:.6rem}
.q{height:3.6rem;display:flex;align-items:center;gap:.5rem;padding:0 1.1rem;border-radius:1.8rem;background:rgba(255,255,255,.08);border:1px solid var(--card-edge);font-size:1.25rem;font-weight:600}
.q .ok{color:var(--green)}
.q .spin{width:1.4rem;height:1.4rem;border-radius:50%;border:.2rem solid rgba(255,255,255,.2);border-top-color:var(--coral);animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

.temps{display:grid;gap:.7rem;align-content:stretch;grid-auto-rows:1fr}
.tile{position:relative;display:flex;align-items:center;gap:.9rem;padding:.6rem 1rem;border-radius:var(--r)}
.ti{flex:none;width:3rem;height:3rem;border-radius:.9rem;display:grid;place-items:center;background:rgba(255,255,255,.08);color:var(--dim)}
.tx{display:grid;gap:.05rem;min-width:0}
.lbl{font-size:1.1rem;color:var(--dim);font-weight:500}
.now{font-size:2.2rem;font-weight:600;line-height:1.05;letter-spacing:-.03em}
.now i{font-style:normal;font-weight:400;color:var(--dim)}
.tgt{position:absolute;top:.7rem;right:1rem;font-size:1.05rem;color:var(--dim)}
.hot .ti{color:var(--coral)}
.hot .now{color:var(--coral)}

.acts{grid-column:1 / -1;display:flex;gap:.8rem}
.btn{flex:1;height:5rem;border-radius:var(--r);display:flex;align-items:center;justify-content:center;gap:.7rem;font-size:1.5rem;font-weight:600}
.btn.sq{flex:none;width:5rem}
.btn.main{background:var(--primary);color:var(--on-primary);border:0;box-shadow:none}
.btn.danger .ic{color:var(--red)}

.dock{grid-column:1 / -1;display:flex;gap:.4rem;padding:.5rem;border-radius:var(--r-lg)}
.dk{flex:1;height:4.6rem;border-radius:var(--r);display:flex;align-items:center;justify-content:center;gap:.8rem;font-size:1.3rem;font-weight:600}
.di{width:3rem;height:3rem;border-radius:.85rem;display:grid;place-items:center;background:var(--tile);color:var(--tile-ink)}
.dk.soon{opacity:.5}
</style>

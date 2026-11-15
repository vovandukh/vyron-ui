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

// Картка очікування
const zPos = computed(() => (p.homed.includes('z') && p.position ? p.position[2].toFixed(1) : '—'))
const jobName = computed(() => String((p.lastJob || {}).filename || '').replace(/^.*\//, '').replace(/\.gcode$/i, ''))
const jobTime = computed(() => (p.lastJob && p.lastJob.print_duration ? fmtDuration(p.lastJob.print_duration, t) : ''))

const DOCK = [
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
        <small>{{ t('scr.hello') }}<template v-if="p.hostname"> · {{ p.hostname }}</template></small>
        <b>{{ t('scr.idle') }}</b>
        <!-- Готовність машини: які осі в нулі, чи вирівняний портал, де зараз голова -->
        <div class="stat">
          <span class="cell">
            <em>{{ t('scr.axes') }}</em>
            <span class="axes"><i v-for="a in 'xyz'" :key="a" :class="{ on: p.homed.includes(a) }">{{ a.toUpperCase() }}</i></span>
          </span>
          <span v-if="p.leveling" class="cell">
            <em>{{ p.leveling.kind === 'ztilt' ? 'Z-Tilt' : 'QGL' }}</em>
            <span class="val" :class="{ good: p.leveled }"><Icon v-if="p.leveled" name="check" size="1.4rem" :stroke="3" />{{ p.leveled ? 'OK' : t('scr.notLeveled') }}</span>
          </span>
          <span class="cell">
            <em>{{ t('scr.pos') }} Z</em>
            <span class="val">{{ zPos }}</span>
          </span>
        </div>
        <div v-if="p.lastJob !== undefined" class="last">
          <template v-if="p.lastJob">
            <Icon :name="p.lastJob.status === 'completed' ? 'check' : 'stop'" size="1.3rem" :stroke="2.8" :class="p.lastJob.status === 'completed' ? 'good' : 'bad'" />
            <span class="lf">{{ jobName }}</span>
            <span class="ld">{{ jobTime }}</span>
          </template>
          <span v-else class="lf">{{ t('scr.noJobs') }}</span>
        </div>
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
    <!-- Без друку: дві окремі картки — розділи (Рух, Нагрів, Налаштування) і швидкі дії (Home, QGL, мотори) -->
    <footer v-else class="cards">
      <nav class="dock glass">
        <button v-for="d in DOCK" :key="d.id" type="button" class="dk tap" :class="{ soon: d.soon }" @click="open(d)">
          <Icon :name="d.icon" size="2rem" />
          <span class="dl">{{ t('scr.page.' + d.id) }}</span>
        </button>
      </nav>
      <div class="dock glass">
        <button type="button" class="dk tap" :disabled="!!p.moving" @click="p.homeAll()">
          <i v-if="p.moving === 'home'" class="spin"></i><Icon v-else name="home" size="2rem" />
          <span class="dl">{{ t('jog.homeAll') }}</span>
        </button>
        <button v-if="p.leveling" type="button" class="dk tap" :disabled="!!p.moving" @click="p.level()">
          <i v-if="p.moving === 'level'" class="spin"></i><Icon v-else name="level" size="2rem" />
          <span class="dl">{{ p.leveling.kind === 'ztilt' ? 'Z-Tilt' : 'QGL' }}<Icon v-if="p.leveled" name="check" size="1.2rem" :stroke="3" class="ok" /></span>
        </button>
        <button type="button" class="dk tap" :disabled="!!p.moving" @click="p.motorsOff()">
          <Icon name="motors" size="2rem" />
          <span class="dl">{{ t('jog.motorsShort') }}</span>
        </button>
      </div>
    </footer>
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

/* Очікування: та сама легка шестикутна сітка, що й під моделлю, але приглушена до правого верхнього кута */
.hero:not(.model)::before{content:'';position:absolute;inset:0;pointer-events:none;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='48' viewBox='0 0 28 48'%3E%3Cpath d='M14 0 28 8v16L14 32 0 24V8zM14 32v16' fill='none' stroke='%23ffffff' stroke-opacity='.09' stroke-width='1'/%3E%3C/svg%3E") center / 2.8rem 4.8rem;
  -webkit-mask-image:radial-gradient(ellipse 70% 80% at 100% 0,#000 10%,transparent 85%);mask-image:radial-gradient(ellipse 70% 80% at 100% 0,#000 10%,transparent 85%)}
.idle{position:relative;flex:1;min-width:0;display:grid;gap:.45rem;padding-left:.6rem}
.idle small{font-size:1.1rem;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.idle b{font-size:2.5rem;font-weight:700;letter-spacing:-.03em;line-height:1.1}
.stat{display:flex;margin-top:.7rem;padding:.7rem 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.cell{flex:1;min-width:0;display:grid;gap:.3rem;padding-right:.6rem}
.cell + .cell{padding-left:.9rem;border-left:1px solid var(--line)}
.cell em{font-style:normal;font-size:1rem;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
.val{display:flex;align-items:center;gap:.25rem;font-size:1.5rem;font-weight:600;white-space:nowrap}
.val.good,.good{color:var(--green)}
.bad{color:var(--dim)}
.axes{display:flex;gap:.35rem}
.axes i{font-style:normal;font-size:1.5rem;font-weight:600;color:var(--dim2)}
.axes i.on{color:var(--ink)}
.last{display:flex;align-items:center;gap:.5rem;margin-top:.2rem;font-size:1.15rem;color:var(--dim);min-width:0}
.lf{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ld{flex:none}
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

/* Дві картки внизу: ліва ширша — у неї довші підписи (Налаштування) */
.cards{grid-column:1 / -1;display:grid;grid-template-columns:1.12fr 1fr;gap:.8rem}
.dock{display:flex;gap:.2rem;padding:.4rem;border-radius:var(--r-lg)}
.dk{flex:1;min-width:0;height:5.4rem;border-radius:var(--r);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem;color:var(--tile-ink)}
.dl{max-width:100%;display:flex;align-items:center;gap:.3rem;font-size:1.05rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dl .ok{color:var(--green)}
.spin{width:2rem;height:2rem;border-radius:50%;border:.22rem solid rgba(255,255,255,.18);border-top-color:var(--ink);animation:spin .8s linear infinite}
.dk.soon{opacity:.5}
</style>

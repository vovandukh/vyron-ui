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
/** Праворуч угорі плитки — потужність нагрівача у відсотках (як у KlipperScreen) або «Вимк.» */
const ROOM = 20
function heatState(h) {
  if (h.target === undefined) return null                     // датчик без цілі (камера)
  if (!(h.target > 0)) return { text: t('qs.off') }
  return h.power != null ? { text: Math.round(h.power * 100) + '%', pw: true } : null
}
/** Скільки шляху від кімнатної до цілі вже пройдено (0…100) */
const heatPct = h => (h.target > ROOM ? Math.max(0, Math.min(100, ((h.temperature ?? ROOM) - ROOM) / (h.target - ROOM) * 100)) : 0)
/** Модель показуємо, коли G-code розібрано; інакше (завантаження, завеликий файл) — кільце прогресу */
const showModel = computed(() => p.showModel && p.gcodeState === 'ready')
const pctShown = computed(() => (p.printState === 'complete' ? 100 : pct.value))

// Картка очікування
const zPos = computed(() => (p.homed.includes('z') && p.position ? p.position[2].toFixed(1) : '—'))
const jobName = computed(() => String((p.lastJob || {}).filename || '').replace(/^.*\//, '').replace(/\.gcode$/i, ''))
const jobTime = computed(() => (p.lastJob && p.lastJob.print_duration ? fmtDuration(p.lastJob.print_duration, t) : ''))

const DOCK = [
  { id: 'files', icon: 'files' },
  { id: 'move', icon: 'move' },
  { id: 'temp', icon: 'flame' }
]
function open(d) { if (!d.soon) p.go(d.id) }
</script>

<template>
  <div class="home page">
    <section class="hero" :class="{ glass: !showModel, model: showModel, tunable: p.active }" @click="p.active && p.go('tune')">
      <!-- Модель друку (G-code) без картки — просто на фоні екрана, як 3D-сцена у вебі.
           Зліва вгорі — відсоток у скляній картці; унизу — плашка з файлом, шаром і часом та смужкою прогресу. -->
      <template v-if="showModel">
        <GcodeView />
        <div class="jpc glass"><b>{{ pctShown }}</b><small>%</small></div>
        <div class="job glass">
          <span class="jt">
            <span class="jf">{{ file }}</span>
            <span class="js">
              <template v-if="p.printState === 'complete'"><Icon name="check" size="1.2rem" :stroke="3" class="good" />{{ t('state.complete') }}</template>
              <template v-else>
                <span v-if="p.layer">{{ t('scr.layer', p.layer) }}</span>
                <span v-if="p.layer && left" class="sep">·</span>
                <span v-if="left">{{ left }}</span>
              </template>
            </span>
          </span>
          <i class="jtrack"><i class="jbar" :style="{ width: pctShown + '%' }"></i></i>
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
      <div v-if="!showModel && !p.active" class="idle">
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
        <span class="th">
          <span class="ti"><Icon :name="h.icon" size="1.5rem" /></span>
          <span class="lbl">{{ t(h.key) }}</span>
          <span v-if="heatState(h)" class="hs" :class="{ pw: heatState(h).pw }">{{ heatState(h).text }}</span>
        </span>
        <span class="tv">
          <span class="now">{{ temp(h.temperature) }}<i>°</i></span>
          <span v-if="hot(h)" class="tg">/ {{ temp(h.target) }}°</span>
        </span>
        <i v-if="hot(h)" class="tb"><i :style="{ width: heatPct(h) + '%' }"></i></i>
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
      <button type="button" class="btn glass sq tap" :aria-label="t('tune.open')" @click="p.go('tune')"><Icon name="sliders" size="2rem" /></button>
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
/* Без картки нічого не обрізаємо: інакше кути скляних плашок зрізались би під радіус зони */
.hero.model{padding:0;overflow:visible;border-radius:0}
/* Підписи поверх моделі; знизу — легке затемнення, щоб назва читалась, якщо модель заходить під неї */
/* Плашка друку: те саме скло, що й плитки температур; відсоток великий, решта — дрібніше й тьмяніше */
.job{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:1rem;padding:.7rem 1.1rem 1.35rem;border-radius:var(--r);overflow:hidden;pointer-events:none}
/* Відсоток — окрема скляна картка зліва вгорі, як було, але в стилі плиток */
.jpc{position:absolute;left:0;top:0;display:flex;align-items:baseline;padding:.6rem 1rem .7rem;border-radius:var(--r);pointer-events:none}
.jpc b{font-size:2.8rem;font-weight:700;letter-spacing:-.05em;line-height:1}
.jpc small{font-size:1.3rem;font-weight:600;color:var(--dim);margin-left:.1rem}
.jt{min-width:0;display:grid;gap:.2rem}
.jf{font-size:1.25rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.js{display:flex;align-items:center;gap:.35rem;font-size:1.1rem;color:var(--dim);white-space:nowrap;overflow:hidden}
.js .sep{opacity:.6}
/* Смужка прогресу — доріжка з відступами від країв (заокруглення плашки її не зрізає),
   заповнення — градієнт фірмового кольору, як у кільці */
.jtrack{position:absolute;left:1.1rem;right:1.1rem;bottom:.6rem;height:.35rem;border-radius:.2rem;background:rgba(255,255,255,.08);overflow:hidden}
.jbar{display:block;height:100%;border-radius:.2rem;background:linear-gradient(90deg,var(--coral),var(--brand));transition:width 1s linear}

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
.hero:not(.model)::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:calc(.5 * var(--grid-k));
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='48' viewBox='0 0 28 48'%3E%3Cpath d='M14 0 28 8v16L14 32 0 24V8zM14 32v16' fill='none' stroke='%23ffffff' stroke-opacity='.18' stroke-width='1'/%3E%3C/svg%3E") center / 2.8rem 4.8rem;
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
/* Плитка нагрівача: угорі іконка, назва і стан («Нагрів 64%», «Тримає», «Вимк.»),
   посередині велика температура з ціллю, унизу — смужка: скільки шляху до цілі пройдено */
.tile{position:relative;display:flex;flex-direction:column;justify-content:center;gap:.35rem;padding:.7rem 1rem .8rem;border-radius:var(--r);min-width:0}
.th{display:flex;align-items:center;gap:.6rem;min-width:0}
.ti{flex:none;width:2.5rem;height:2.5rem;border-radius:.8rem;display:grid;place-items:center;background:rgba(255,255,255,.08);color:var(--dim)}
.lbl{font-size:1.1rem;color:var(--dim);font-weight:500;white-space:nowrap}
.hs{margin-left:auto;font-size:1.05rem;color:var(--dim);white-space:nowrap}
.hs.pw{font-weight:600;color:var(--tile-ink);font-variant-numeric:tabular-nums}
.tv{display:flex;align-items:baseline;gap:.5rem;min-width:0}
.now{font-size:2.4rem;font-weight:600;line-height:1.05;letter-spacing:-.03em}
.now i{font-style:normal;font-weight:400;color:var(--dim)}
.tg{font-size:1.2rem;color:var(--dim);white-space:nowrap}
.tb{display:block;height:.3rem;border-radius:.2rem;background:rgba(255,255,255,.08);overflow:hidden}
.tb i{display:block;height:100%;border-radius:.2rem;background:linear-gradient(90deg,var(--coral),var(--brand));transition:width 1s linear}
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

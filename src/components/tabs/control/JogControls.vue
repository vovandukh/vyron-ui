<script setup>
import { reactive, computed } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useI18n } from '../../../composables/useI18n'
import Spinner from '../../ui/Spinner.vue'

const printer = usePrinterStore()
const settings = useSettingsStore()
const { t, tm } = useI18n()

const axes = ['X', 'Y', 'Z']
const step = reactive({ X: 10, Y: 10, Z: 1 })

function jog(a, dir) {
  const v = Number(step[a])
  if (!(v > 0) || !Number.isFinite(v)) { printer.ctlMsg = { key: 'jog.badDistance' }; return }
  const d = dir * v * (settings['inv' + a] ? -1 : 1)
  printer.rpc('G91\nG1 ' + a + d + ' F' + (a === 'Z' ? settings.fz : settings.fxy) + '\nG90')
}

// ---------- вирівнювання порталу ----------
const lvlName = computed(() => (printer.leveling && printer.leveling.kind === 'ztilt' ? 'Z-Tilt' : 'QGL'))
const lvlTitle = computed(() => t(printer.levelingBusy ? 'jog.levelRunning' : printer.qgl ? 'jog.levelDone' : 'jog.levelRun', { n: lvlName.value }))
async function level() {
  printer.ctlMsg = null
  try { await printer.levelGantry() } catch (e) { printer.ctlMsg = { key: 'jog.levelFailed', params: { msg: (e && e.message) || '' } } }
}

const posText = i => (printer.position ? Number(printer.position[i]).toFixed(1) : '–')
</script>

<template>
  <!-- Одна скляна панель (як телеметрія праворуч): елементи не губляться на фоні сцени й сітки -->
  <div class="ctl glass">
    <div class="hd">
      <span class="ttl">{{ t('jog.title') }}</span>
      <div class="hrow">
        <button class="home" :title="t('jog.home')" aria-label="Home" :disabled="printer.isPrinting" @click="printer.rpc('G28')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5.5h4V20" /></svg>
        </button>
        <!-- Вирівнювання порталу (QGL / Z-Tilt): стан видно на кнопці, під час виконання — індикатор активності -->
        <button v-if="printer.leveling" class="home lvl" :class="{ ok: printer.qgl === true, need: printer.qgl === false, busy: printer.levelingBusy }"
                :title="lvlTitle" :aria-label="lvlTitle" :aria-busy="String(printer.levelingBusy)" :disabled="printer.isPrinting || printer.levelingBusy" @click="level">
          <Spinner v-if="printer.levelingBusy" :size="14" />
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15h16M7 15V9M17 15V9" /><circle cx="7" cy="7" r="1.6" /><circle cx="17" cy="7" r="1.6" /><path d="M10 19h4" /></svg>
          <span>{{ lvlName }}</span>
          <i v-if="!printer.levelingBusy && printer.qgl != null" class="badge" aria-hidden="true"></i>
        </button>
        <button class="home" :title="t('jog.motorsOff')" :aria-label="t('jog.motorsOffAria')" :disabled="printer.isPrinting" @click="printer.rpc('M84')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>
        </button>
      </div>
    </div>
    <div v-for="(a, i) in axes" :key="a" class="ax">
      <!-- Мітка осі — в основному акцентному кольорі інтерфейсу -->
      <span class="al">{{ a }}</span>
      <div class="seg">
        <button :disabled="printer.isPrinting" :aria-label="a + ' −'" @click="jog(a, -1)">−</button>
        <input v-model="step[a]" type="number" min=".01" step="any" :aria-label="t('jog.step', { a })" :disabled="printer.isPrinting">
        <button :disabled="printer.isPrinting" :aria-label="a + ' +'" @click="jog(a, 1)">+</button>
      </div>
      <span class="pos" :title="t('jog.position', { a })">{{ posText(i) }}</span>
    </div>
    <div v-if="printer.ctlMsg" class="cmsg">{{ tm(printer.ctlMsg) }}</div>
  </div>
</template>

<style scoped>
.ctl{position:fixed;left:32px;top:50%;transform:translateY(-50%);display:grid;gap:8px;padding:12px;border-radius:var(--r-lg);font-size:12px;z-index:3}
.hd{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 2px 2px}
.ttl{font-size:11px;font-weight:500;color:var(--dim);letter-spacing:.06em;text-transform:uppercase}
/* Кнопки — світліші поверхні на склі: тактильні, з м'яким підсвічуванням і пружним натисканням */
.ctl button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.06);color:var(--ink);font:inherit;cursor:pointer;
  transition:transform var(--t-spring) var(--spring),color var(--t-fast) var(--ease-out),background-color var(--t-fast) var(--ease-out),border-color var(--t-fast) var(--ease-out)}
.ctl button:hover:not(:disabled){color:var(--coral);background-color:rgba(255,255,255,.11);border-color:rgba(255,255,255,.14)}
.ctl button:active:not(:disabled){transform:scale(.95);background-color:rgba(var(--accent-rgb),.16)}
.ctl button:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
.ctl button:disabled,.ctl input:disabled{opacity:.35;cursor:not-allowed}
.hrow{display:flex;gap:6px}
.ctl .home{width:38px;height:34px;padding:0;border-radius:var(--r);display:grid;place-items:center}
.ctl .home svg{width:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
/* Кнопка QGL / Z-Tilt: ширша, з підписом; кутова позначка стану — зелена (вирівняно) або коралова (треба вирівняти) */
.ctl .lvl{position:relative;width:auto;display:inline-flex;gap:6px;padding:0 11px;font-size:11.5px;font-weight:600;letter-spacing:.02em}
.ctl .lvl svg circle{fill:currentColor;stroke:none}
.lvl .badge{position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:50%;border:2px solid #17171a}
.lvl.ok .badge{background:#34c759;box-shadow:0 0 6px rgba(52,199,89,.7)}
.lvl.need .badge{background:var(--coral);box-shadow:0 0 8px rgba(var(--accent-rgb),.9);animation:lvl-pulse 1.8s cubic-bezier(.45,0,.55,1) infinite}
.ctl .lvl.need{border-color:rgba(var(--accent-rgb),.4)}
.ctl .lvl.busy{color:var(--ink);border-color:rgba(var(--accent-rgb),.45);background-color:rgba(var(--accent-rgb),.12);cursor:progress}
.ctl .lvl.busy:disabled{opacity:1}
@keyframes lvl-pulse{50%{opacity:.4}}
.ax{display:flex;align-items:center;gap:10px}
/* Сегмент «− крок +»: одна поверхня з тонкими розділювачами */
.seg{display:flex;border-radius:var(--r);overflow:hidden;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.25)}
.ctl .seg button{width:38px;height:38px;font-size:18px;border:0;border-radius:0;background:rgba(255,255,255,.05)}
.ctl .seg button:first-child{border-right:1px solid rgba(255,255,255,.07)}
.ctl .seg button:last-child{border-left:1px solid rgba(255,255,255,.07)}
.seg input{width:50px;padding:0;margin:0;background:none;border:0;color:var(--ink);text-align:center;font:inherit;font-size:13px;font-weight:500;-moz-appearance:textfield;appearance:textfield}
.seg input:focus{outline:none;background:rgba(var(--accent-rgb),.1)}
.seg input::-webkit-inner-spin-button,.seg input::-webkit-outer-spin-button{-webkit-appearance:none;appearance:none;margin:0}
.al{flex:none;width:24px;height:24px;border-radius:var(--r-sm);display:grid;place-items:center;font-size:12px;font-weight:700;
  color:var(--coral);background:rgba(var(--accent-rgb),.14);box-shadow:inset 0 0 0 1px rgba(var(--accent-rgb),.3)}
/* Поточна координата — яскраво й табличними цифрами */
.pos{min-width:48px;text-align:right;color:var(--ink);font-size:13px;font-weight:300}
.cmsg{color:var(--coral);font-size:11px;max-width:230px;padding:0 2px}
@media(max-width:900px){.ctl{left:14px}}
@media(max-width:560px){.ctl{top:43%;gap:6px;padding:10px}.ctl .seg button{width:30px}.seg input{width:36px}.pos{display:none}}
</style>

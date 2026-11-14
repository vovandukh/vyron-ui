<script setup>
import { reactive } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useI18n } from '../../../composables/useI18n'

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

const posText = i => (printer.position ? Number(printer.position[i]).toFixed(1) : '–')
</script>

<template>
  <div class="ctl">
    <div class="hrow">
      <button class="home glass" :title="t('jog.home')" aria-label="Home" :disabled="printer.isPrinting" @click="printer.rpc('G28')">
        <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5.5h4V20" /></svg>
      </button>
      <button class="home glass" :title="t('jog.motorsOff')" :aria-label="t('jog.motorsOffAria')" :disabled="printer.isPrinting" @click="printer.rpc('M84')">
        <svg viewBox="0 0 24 24"><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>
      </button>
    </div>
    <div v-for="(a, i) in axes" :key="a" class="ax">
      <span class="al">{{ a }}</span>
      <div class="seg glass">
        <button :disabled="printer.isPrinting" @click="jog(a, -1)">−</button>
        <input v-model="step[a]" type="number" min=".01" step="any" :disabled="printer.isPrinting">
        <button :disabled="printer.isPrinting" @click="jog(a, 1)">+</button>
      </div>
      <span class="pos">{{ posText(i) }}</span>
    </div>
    <div class="cmsg">{{ tm(printer.ctlMsg) }}</div>
  </div>
</template>

<style scoped>
.ctl{position:fixed;left:32px;top:50%;transform:translateY(-50%);display:grid;gap:10px;font-size:12px}
/* Кнопки — тактильні: м'яке підсвічування при наведенні, пружне «втискання» при натисканні */
.ctl button{background:none;border:0;color:var(--ink);font:inherit;cursor:pointer;
  transition:transform var(--t-spring) var(--spring),color var(--t-fast) var(--ease-out),background-color var(--t-fast) var(--ease-out),box-shadow var(--t-mid) var(--ease-out)}
.ctl button:hover:not(:disabled){color:var(--coral);background-color:rgba(255,255,255,.06)}
.ctl button:active:not(:disabled){transform:scale(.95);background-color:rgba(255,107,90,.14)}
.ctl button:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
.ctl button:disabled,.ctl input:disabled{opacity:.35;cursor:not-allowed}
.hrow{display:flex;gap:8px;margin-left:21px;width:126px}
/* .glass задає фон/межі; селектор .ctl .home потрібен, щоб перебити скидання фону з .ctl button */
.ctl .home{flex:1;height:38px;border-radius:12px;display:grid;place-items:center;background-color:var(--glass-bg);border:1px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi)}
.ctl .home:hover:not(:disabled){box-shadow:var(--glass-shadow),0 0 18px -6px rgba(255,107,90,.55)}
.ctl .home svg{width:19px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.ax{display:flex;align-items:center;gap:9px}
.seg{display:flex;border-radius:12px;overflow:hidden}
.seg button{width:38px;height:38px;font-size:18px}
.seg button:first-child{border-right:1px solid rgba(255,255,255,.06)}
.seg button:last-child{border-left:1px solid rgba(255,255,255,.06)}
/* Chrome резервує в type=number місце під невидимі стрілки-спінери (~15px праворуч),
   через що число зсувалось на ~8px ліворуч від центру. Ховаємо спінери й обнуляємо відступи. */
.seg input{width:48px;padding:0;margin:0;background:none;border:0;color:var(--ink);text-align:center;font:inherit;-moz-appearance:textfield;appearance:textfield}
.seg input::-webkit-inner-spin-button,.seg input::-webkit-outer-spin-button{-webkit-appearance:none;appearance:none;margin:0}
.al{width:12px;color:var(--red);font-weight:600}
.pos{width:44px;color:var(--dim);font-size:11px}
.cmsg{color:var(--red);font-size:11px;max-width:220px;min-height:14px}
@media(max-width:900px){.ctl{left:14px}}
@media(max-width:560px){.ctl{top:43%;gap:7px}.seg button{width:30px}.seg input{width:35px}.pos{display:none}}
</style>

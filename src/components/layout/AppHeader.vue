<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useUiStore } from '../../stores/uiStore'
import { useI18n } from '../../composables/useI18n'
import { fmtDuration } from '../../utils/format'
import EStopButton from './EStopButton.vue'
import HeaderMenu from './HeaderMenu.vue'
import logo from '../../assets/voron-logo.png'

const printer = usePrinterStore()
const ui = useUiStore()
const { t, tm } = useI18n()

// Головки окремої вкладки не мають: деталі голови відкриваються кліком по T0…TN у смузі на «Керуванні».
const tabs = ['main', 'console', 'mesh', 'hist', 'eng', 'cfg']
// Назва принтера в шапці та вкладці браузера — завжди «Voron 2.4» (hostname хоста, напр. bigtreetech-cb1, не показуємо).
document.title = 'Voron 2.4'

const eta = computed(() => (printer.etaSeconds == null ? '' : t('eta.left', { t: fmtDuration(printer.etaSeconds, t) })))

// Висота шапки → CSS-змінна --hb, від неї відраховуються панелі та блок статусу.
const hd = ref(null)
let ro = null
const fit = () => { if (hd.value) document.documentElement.style.setProperty('--hb', Math.ceil(hd.value.getBoundingClientRect().bottom) + 'px') }
onMounted(() => {
  fit()
  addEventListener('resize', fit)
  if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(hd.value) }
})
onBeforeUnmount(() => { removeEventListener('resize', fit); ro?.disconnect() })
</script>

<template>
  <header ref="hd" class="hd">
    <span class="wm"><img :src="logo" width="30" height="30" alt="Voron"><b>VORON</b><i>2.4</i></span>
    <nav class="nav">
      <button v-for="v in tabs" :key="v" :class="{ on: ui.view === v }" @click="ui.go(v)">{{ t('nav.' + v) }}</button>
    </nav>
    <span>{{ tm(printer.stateLabel) }}</span><span>{{ eta }}</span>
    <div class="acts">
      <EStopButton />
      <HeaderMenu />
    </div>
  </header>
</template>

<style scoped>
/* row-gap після gap: шорткат gap інакше скидає row-gap до 20px */
.hd{position:fixed;top:20px;left:32px;right:32px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px;row-gap:8px;font-size:12px;color:var(--dim);pointer-events:none;z-index:8}
.wm{display:flex;align-items:center;gap:12px;font-weight:600;color:var(--ink);letter-spacing:.15em;white-space:nowrap}
.wm b{color:var(--red);font-weight:600}
.wm i{font-style:normal;font-weight:200;color:var(--dim);max-width:220px;overflow:hidden;text-overflow:ellipsis}
.wm img{display:block}
.nav{display:flex;gap:22px;pointer-events:auto}
.nav button{background:none;border:0;border-bottom:2px solid transparent;color:var(--dim);font:inherit;padding:6px 2px;cursor:pointer}
.nav button.on{color:var(--ink);border-bottom-color:var(--red)}
.nav button:hover{color:var(--ink)}
.acts{display:flex;gap:8px;align-items:center;pointer-events:auto}
@media(max-width:900px){
  .hd{left:16px;right:16px;top:12px}
  .nav{gap:10px;order:3;width:100%;justify-content:center}
}
@media(max-width:560px){
  .nav{gap:7px}
  .nav button{font-size:10px}
  .wm{font-size:11px}
}
</style>

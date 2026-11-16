<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useUiStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../composables/useI18n'
import EStopButton from './EStopButton.vue'
import HeaderMenu from './HeaderMenu.vue'
import StatusIsland from './StatusIsland.vue'
import VyronLogo from '../ui/VyronLogo.vue'
import { DEMO_BUILD } from '../../config'
// Демо: капсула «Екран принтера ↗» — лише в демо-збірці (у збірці для принтера цього коду немає)
const DemoScreenChip = DEMO_BUILD ? defineAsyncComponent(() => import('./DemoScreenChip.vue')) : null

const ui = useUiStore()
const settings = useSettingsStore()
const { t } = useI18n()

// Головки окремої вкладки не мають: деталі голови відкриваються кліком по T0…TN у смузі на «Керуванні».
const tabs = ['main', 'console', 'mesh', 'hist', 'eng']
/** Іконки вкладок — лише на вузьких телефонах (≤480 px), де повні назви не вміщаються */
const ICONS = {
  main: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  console: 'M4 5.5h16v13H4ZM7.5 10l2.5 2-2.5 2M12 14.5h4',
  mesh: 'M3.5 9 12 4.5 20.5 9 12 13.5ZM3.5 9v6l8.5 4.5 8.5-4.5V9M7.8 11.3v6M16.2 11.3v6M12 13.5v6',
  hist: 'M12 7v5l3 2M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3h3',
  eng: 'M14.5 6.5a3.5 3.5 0 0 0-4.6 4.6L4.5 16.5l3 3 5.4-5.4a3.5 3.5 0 0 0 4.6-4.6l-2.2 2.2-2-2Z'
}
// Назва у вкладці браузера — бренд екосистеми (hostname хоста, напр. bigtreetech-cb1, не показуємо).
document.title = 'Vyron'

// ---------- капсула активної вкладки (аналог layoutId: одна капсула перетікає між кнопками) ----------
const nav = ref(null)
const btns = {}
const pill = ref({ x: 0, w: 0, on: false })
const instant = ref(true)
function place() {
  const b = btns[ui.view]
  if (!b) { pill.value = { ...pill.value, on: false }; return }
  pill.value = { x: b.offsetLeft, w: b.offsetWidth, on: true }
}
// Відкриті вікна меню (налаштування тощо) — не вкладки: капсула гасне на місці, а не їде.
watch(() => ui.view, () => nextTick(place))
// Зміна мови міняє ширину кнопок — капсулу переставляємо без анімації.
watch(() => settings.lang, () => { instant.value = true; nextTick(() => { place(); requestAnimationFrame(() => { instant.value = false }) }) })

// Висота шапки → CSS-змінна --hb, від неї відраховуються панелі та блок статусу.
const hd = ref(null)
let ro = null, navRo = null
const fit = () => { if (hd.value) document.documentElement.style.setProperty('--hb', Math.ceil(hd.value.getBoundingClientRect().bottom) + 'px') }
const onResize = () => { fit(); place() }
onMounted(() => {
  fit(); place()
  // Перший кадр — без анімації, далі капсула рухається пружиною
  requestAnimationFrame(() => requestAnimationFrame(() => { instant.value = false }))
  addEventListener('resize', onResize)
  if (window.ResizeObserver) {
    ro = new ResizeObserver(fit); ro.observe(hd.value)
    navRo = new ResizeObserver(place); navRo.observe(nav.value)
  }
  document.fonts?.ready?.then(place)
})
onBeforeUnmount(() => { removeEventListener('resize', onResize); ro?.disconnect(); navRo?.disconnect() })
</script>

<template>
  <header ref="hd" class="hd">
    <div class="lead">
      <!-- Логотип — «Додому»: вкладка «Керування» + закрити поповери й меню -->
      <button type="button" class="wm" :title="t('nav.home')" :aria-label="t('nav.home')" @click="ui.goHome()">
        <VyronLogo :size="30" /><b>VYRON</b>
      </button>
      <StatusIsland />
    </div>
    <nav ref="nav" class="nav glass">
      <span class="pill" :class="{ on: pill.on, instant }" :style="{ transform: `translateX(${pill.x}px)`, width: pill.w + 'px' }" aria-hidden="true"></span>
      <button v-for="v in tabs" :key="v" :ref="el => { if (el) btns[v] = el }" :class="{ on: ui.view === v }"
              :aria-current="ui.view === v ? 'page' : null" :aria-label="t('nav.' + v)" @click="ui.go(v)">
        <svg class="ni" viewBox="0 0 24 24" aria-hidden="true"><path :d="ICONS[v]" /></svg>
        <span class="nl">{{ t('nav.' + v) }}</span><span class="ns">{{ t('navs.' + v) }}</span>
      </button>
    </nav>
    <div class="acts">
      <component :is="DemoScreenChip" v-if="DemoScreenChip" />
      <EStopButton />
      <HeaderMenu />
    </div>
  </header>
</template>

<style scoped>
/* row-gap після gap: шорткат gap інакше скидає row-gap до 20px */
.hd{position:fixed;top:20px;left:32px;right:32px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px;row-gap:8px;font-size:12px;color:var(--dim);pointer-events:none;z-index:8}
.lead{display:flex;align-items:center;gap:14px;min-width:0}
.wm{display:flex;align-items:center;gap:12px;font:inherit;font-weight:600;color:var(--ink);letter-spacing:.15em;white-space:nowrap;
  background:none;border:0;padding:4px 8px 4px 4px;margin:-4px -8px -4px -4px;border-radius:12px;cursor:pointer;pointer-events:auto;
  transition:transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out)}
.wm:hover{background:rgba(255,255,255,.05)}
.wm:hover .vl{filter:drop-shadow(0 0 8px rgba(var(--brand-rgb),.5))}
.wm:active{transform:scale(.96)}
.wm:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
.wm .vl{transition:filter var(--t-mid) var(--ease-out)}
.wm b{color:var(--ink);font-weight:600;letter-spacing:.24em}

/* Вкладки: скляна «капсула-доріжка» з однією рухомою підсвіткою */
.nav{position:relative;display:flex;gap:2px;padding:3px;border-radius:999px;pointer-events:auto;max-width:100%;overflow-x:auto;scrollbar-width:none}
.nav::-webkit-scrollbar{display:none}
.nav button{position:relative;z-index:1;flex:none;background:none;border:0;color:var(--dim);font:inherit;padding:7px 14px;border-radius:999px;cursor:pointer;white-space:nowrap;
  transition:color var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.nav button:hover{color:var(--ink)}
.nav button.on{color:var(--ink)}
.nav button:active{transform:scale(.95)}
.nav button:focus-visible{outline:2px solid var(--coral);outline-offset:-2px}
.pill{position:absolute;left:0;top:3px;bottom:3px;border-radius:999px;opacity:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.06));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 0 1px rgba(255,255,255,.04),0 8px 20px -10px rgba(var(--brand-rgb),.75);
  transition:transform var(--t-spring) var(--spring),width var(--t-spring) var(--spring),opacity var(--t-mid) var(--ease-out)}
/* Брендовий акцент: коротка коралова риска під активною вкладкою */
.pill::after{content:'';position:absolute;left:50%;bottom:-1px;width:16px;height:2px;margin-left:-8px;border-radius:2px;background:var(--brand);box-shadow:0 0 8px rgba(var(--brand-rgb),.9)}
.pill.on{opacity:1}
.pill.instant{transition:none}

.acts{display:flex;gap:8px;align-items:center;pointer-events:auto}
/* 1024×600: усе в один рядок — компактніші вкладки та проміжки */
@media(max-width:1100px){
  .hd{gap:12px}
  .lead{gap:10px}
  .nav button{padding:7px 9px}
}
@media(max-width:900px){
  .hd{left:16px;right:16px;top:12px}
  .nav{order:3;margin:0 auto}
}
@media(max-width:560px){
  .nav button{font-size:10px;padding:6px 9px}
  .wm{font-size:11px;gap:8px}
  .lead{gap:8px}
}
/* Іконки й короткі підписи вкладок — приховані, доки є місце для повних назв */
.ni,.ns{display:none}
@media(max-width:480px){
  .nav{width:100%;justify-content:space-between;padding:4px}
  /* Лише текст (короткі назви) рівними сегментами — без іконок, як сегментований перемикач iOS */
  .nav button{flex:1 1 0;min-width:0;padding:8px 2px;font-size:11px;font-weight:500;letter-spacing:0}
  .nl{display:none}
  .ns{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis}
}
/* Вузькі телефони: лишаємо логотип без напису, щоб капсула статусу та STOP влізли в один рядок */
@media(max-width:420px){.wm b,.wm i{display:none}}
</style>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useUiStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../composables/useI18n'
import EStopButton from './EStopButton.vue'
import HeaderMenu from './HeaderMenu.vue'
import StatusIsland from './StatusIsland.vue'
import logo from '../../assets/voron-logo.png'

const ui = useUiStore()
const settings = useSettingsStore()
const { t } = useI18n()

// Головки окремої вкладки не мають: деталі голови відкриваються кліком по T0…TN у смузі на «Керуванні».
const tabs = ['main', 'console', 'mesh', 'hist', 'eng', 'cfg']
// Назва принтера в шапці та вкладці браузера — завжди «Voron 2.4» (hostname хоста, напр. bigtreetech-cb1, не показуємо).
document.title = 'Voron 2.4'

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
      <span class="wm"><img :src="logo" width="30" height="30" alt="Voron"><b>VORON</b><i>2.4</i></span>
      <StatusIsland />
    </div>
    <nav ref="nav" class="nav glass">
      <span class="pill" :class="{ on: pill.on, instant }" :style="{ transform: `translateX(${pill.x}px)`, width: pill.w + 'px' }" aria-hidden="true"></span>
      <button v-for="v in tabs" :key="v" :ref="el => { if (el) btns[v] = el }" :class="{ on: ui.view === v }"
              :aria-current="ui.view === v ? 'page' : null" @click="ui.go(v)">{{ t('nav.' + v) }}</button>
    </nav>
    <div class="acts">
      <EStopButton />
      <HeaderMenu />
    </div>
  </header>
</template>

<style scoped>
/* row-gap після gap: шорткат gap інакше скидає row-gap до 20px */
.hd{position:fixed;top:20px;left:32px;right:32px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px;row-gap:8px;font-size:12px;color:var(--dim);pointer-events:none;z-index:8}
.lead{display:flex;align-items:center;gap:14px;min-width:0}
.wm{display:flex;align-items:center;gap:12px;font-weight:600;color:var(--ink);letter-spacing:.15em;white-space:nowrap}
.wm b{color:var(--red);font-weight:600}
.wm i{font-style:normal;font-weight:200;color:var(--dim);max-width:220px;overflow:hidden;text-overflow:ellipsis}
.wm img{display:block}

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
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 0 1px rgba(255,255,255,.04),0 8px 20px -10px rgba(240,58,46,.75);
  transition:transform var(--t-spring) var(--spring),width var(--t-spring) var(--spring),opacity var(--t-mid) var(--ease-out)}
/* Брендовий акцент: коротка коралова риска під активною вкладкою */
.pill::after{content:'';position:absolute;left:50%;bottom:-1px;width:16px;height:2px;margin-left:-8px;border-radius:2px;background:var(--red);box-shadow:0 0 8px rgba(240,58,46,.9)}
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
/* Вузькі телефони: лишаємо логотип без напису, щоб капсула статусу та STOP влізли в один рядок */
@media(max-width:420px){.wm b,.wm i{display:none}}
</style>

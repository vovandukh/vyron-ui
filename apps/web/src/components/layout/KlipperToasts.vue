<script setup>
// Тости помилок G-code («!! Must home axis first», «!! Move out of range»…) і обриву друку.
// Стриманий системний стиль: нейтральне скло, тонка кольорова смуга зліва, без світіння.
// Стек по центру під шапкою; однакові повідомлення не множаться (лічильник ×N).
// Час життя — CSS-анімація смужки внизу: наведення/фокус ставлять її на паузу, кінець анімації закриває тост.
import { usePrinterStore } from '../../stores/printerStore'
import { useUiStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../composables/useI18n'
import ErrIcon from '../ui/ErrIcon.vue'

const printer = usePrinterStore()
const ui = useUiStore()
const settings = useSettingsStore()
const { t } = useI18n()

/** Червоні — те, що зупиняє роботу (нагрів, плата, драйвер, обрив друку); решта — бурштинові попередження.
 *  «Холодне сопло» — лише пропущена команда, тому попередження, хоч і з категорії нагріву. */
const HARD = new Set(['heat', 'mcu', 'driver', 'estop'])
const tone = a => (a.src === 'print' || (HARD.has(a.info.cat) && a.info.id !== 'cold') ? 'err' : 'warn')
const title = a => (a.info.id === 'generic' ? a.info.head : t('kerr.' + a.info.id + '.t', a.info.params))
/** Пояснення простими словами; для нерозпізнаної помилки — друга частина повідомлення Klipper, якщо є. */
function desc(a) {
  if (a.info.id === 'generic') return a.info.body.split('\n')[0]
  const key = 'kerr.' + a.info.id + '.d', v = t(key)
  return v === key ? '' : v
}
const meta = a => (a.src === 'print' ? t('kerr.printStopped') : t('kerr.cat.' + a.info.cat))
const life = a => (tone(a) === 'err' ? 16 : 10)

function toConsole(a) {
  printer.dismissAlert(a.id)
  ui.go('console')
}
</script>

<template>
  <div v-if="settings.toasts" class="kt" aria-live="assertive">
    <TransitionGroup name="kt">
      <article v-for="a in printer.alerts" :key="a.id" class="toast" :class="'t-' + tone(a)" role="alert" tabindex="-1" :title="a.info.head">
        <span class="ic"><ErrIcon :cat="a.info.cat" :size="18" /></span>
        <div class="bd">
          <small class="meta">{{ meta(a) }}<span v-if="a.n > 1" class="n">×{{ a.n }}</span></small>
          <b class="ttl">{{ title(a) }}</b>
          <p v-if="desc(a)" class="desc">{{ desc(a) }}</p>
          <button type="button" class="lnk" @click="toConsole(a)">{{ t('kerr.toConsole') }}</button>
        </div>
        <button type="button" class="x" :aria-label="t('kerr.close')" :title="t('kerr.close')" @click="printer.dismissAlert(a.id)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
        <!-- :key за часом — повтор того самого повідомлення запускає відлік заново -->
        <i :key="a.at" class="life" :style="{ animationDuration: life(a) + 's' }" @animationend="printer.dismissAlert(a.id)"></i>
      </article>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.kt{position:fixed;top:calc(var(--hb,72px) + 10px);left:50%;transform:translateX(-50%);z-index:11;width:min(400px,calc(100vw - 32px));display:grid;gap:8px;pointer-events:none}
.toast{--tone:255,159,10;position:relative;display:flex;align-items:flex-start;gap:12px;padding:13px 12px 14px 16px;border-radius:var(--r-lg);overflow:hidden;pointer-events:auto;color:var(--ink);font-size:12.5px;outline:none;
  background:rgba(26,26,28,calc(1 - 0.06 * var(--glass-t,1)));border:1px solid rgba(255,255,255,.08);
  box-shadow:0 16px 40px -14px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.04)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
  .toast{background:rgba(26,26,28,calc(1 - 0.16 * var(--glass-t,1)));-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur)}
}
.t-err{--tone:255,69,58}
/* Тонка смуга кольору зліва — єдиний кольоровий акцент */
.toast::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:rgb(var(--tone))}
.ic{flex:none;margin-top:1px;color:rgb(var(--tone));display:grid}
.bd{flex:1;min-width:0;display:grid;gap:3px;justify-items:start}
.meta{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:500;color:var(--dim)}
.n{padding:0 5px;border-radius:5px;font-size:10.5px;font-weight:600;color:var(--ink);background:rgba(255,255,255,.08)}
.ttl{font-weight:600;font-size:13.5px;line-height:1.3;letter-spacing:-.005em;overflow-wrap:anywhere}
.desc{margin:1px 0 0;color:#b8bcc3;line-height:1.45;overflow-wrap:anywhere}
.lnk{margin:5px 0 0 -6px;padding:3px 6px;background:none;border:0;font:inherit;font-size:12px;font-weight:500;color:var(--ink);opacity:.75;cursor:pointer;border-radius:6px;
  transition:background-color var(--t-fast) var(--ease-out),opacity var(--t-fast) var(--ease-out)}
.lnk:hover{opacity:1;background:rgba(255,255,255,.07)}
.x{flex:none;width:24px;height:24px;margin:-3px -3px 0 0;display:grid;place-items:center;border-radius:6px;border:0;background:none;color:var(--dim);cursor:pointer;
  transition:background-color var(--t-fast) var(--ease-out),color var(--t-fast) var(--ease-out)}
.x:hover{background:rgba(255,255,255,.08);color:var(--ink)}
.x svg{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.x:focus-visible,.lnk:focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* Смужка часу життя: тане справа наліво; пауза, поки тост під курсором або у фокусі */
.life{position:absolute;left:3px;right:0;bottom:0;height:2px;transform-origin:left;background:rgba(255,255,255,.14);animation:kt-life linear forwards}
.toast:hover .life,.toast:focus-within .life{animation-play-state:paused}
@keyframes kt-life{from{transform:scaleX(1)}to{transform:scaleX(0)}}
/* reduce-motion скорочує всі анімації до 0.001 мс — тоді тост закривається лише вручну */
@media(prefers-reduced-motion:reduce){.life{display:none}}

/* Поява — коротке ковзання згори; зникнення — розчинення; сусіди плавно з'їжджають */
.kt-enter-active{transition:transform .26s var(--ease-out),opacity .2s var(--ease-out)}
.kt-leave-active{transition:opacity .18s var(--ease-out);position:absolute;left:0;right:0}
.kt-move{transition:transform .26s var(--ease-out)}
.kt-enter-from{opacity:0;transform:translateY(-8px)}
.kt-leave-to{opacity:0}
</style>

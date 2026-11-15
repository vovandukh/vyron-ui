<script setup>
// Тости помилок G-code («!! Must home axis first», «!! Move out of range»…) і обриву друку.
// Стек по центру під шапкою: новий тост пружно випадає зверху, однакові повідомлення не множаться (лічильник ×N).
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

/** Червоні — те, що зупиняє роботу (нагрів, MCU, драйвер, обрив друку); решта — бурштинові попередження. */
const HARD = new Set(['heat', 'mcu', 'driver', 'estop'])
const tone = a => (a.src === 'print' || HARD.has(a.info.cat) ? 'err' : 'warn')
const title = a => (a.info.id === 'generic' ? a.info.head : t('kerr.' + a.info.id + '.t', a.info.params))
function hint(a) {
  const key = 'kerr.' + a.info.id + '.h', v = t(key)
  return v === key ? '' : v.split('\n')[0]
}
const life = a => (tone(a) === 'err' ? 14 : 9)

function toConsole(a) {
  printer.dismissAlert(a.id)
  ui.go('console')
}
</script>

<template>
  <div v-if="settings.toasts" class="kt" aria-live="assertive">
    <TransitionGroup name="kt">
      <article v-for="a in printer.alerts" :key="a.id" class="toast" :class="'t-' + tone(a)" role="alert" tabindex="-1">
        <span class="ic"><ErrIcon :cat="a.info.cat" :size="17" /></span>
        <div class="bd">
          <small v-if="a.src === 'print'" class="eb">{{ t('kerr.printStopped') }}</small>
          <b class="ttl">{{ title(a) }}<span v-if="a.n > 1" class="n">×{{ a.n }}</span></b>
          <span v-if="hint(a)" class="hint">{{ hint(a) }}</span>
          <code v-if="a.info.id !== 'generic'" class="raw" :title="a.info.head">{{ a.info.head }}</code>
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
.kt{position:fixed;top:calc(var(--hb,72px) + 12px);left:50%;transform:translateX(-50%);z-index:11;width:min(420px,calc(100vw - 32px));display:grid;gap:8px;pointer-events:none}
.toast{--tone:255,159,10;position:relative;display:flex;align-items:flex-start;gap:12px;padding:12px 12px 14px;border-radius:var(--r-lg);overflow:hidden;pointer-events:auto;color:var(--ink);font-size:12.5px;outline:none;
  background:rgba(22,22,24,calc(1 - 0.08 * var(--glass-t,1)));border:1px solid;border-color:rgba(var(--tone),.38) rgba(255,255,255,.04) rgba(255,255,255,.03) rgba(var(--tone),.2);
  box-shadow:0 0 34px -12px rgba(var(--tone),.55),0 20px 44px -18px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.05)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
  .toast{background:rgba(22,22,24,calc(1 - 0.2 * var(--glass-t,1)));-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur)}
}
.t-err{--tone:240,58,46}
.ic{flex:none;width:34px;height:34px;border-radius:var(--r);display:grid;place-items:center;color:rgb(var(--tone));
  background:radial-gradient(circle at 50% 35%,rgba(var(--tone),.26),rgba(var(--tone),.08));border:1px solid rgba(var(--tone),.3)}
.bd{flex:1;min-width:0;display:grid;gap:3px;justify-items:start}
.eb{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgb(var(--tone))}
.ttl{font-weight:600;font-size:13px;line-height:1.3;overflow-wrap:anywhere}
.n{display:inline-block;margin-left:7px;padding:1px 6px;border-radius:6px;font-size:10.5px;font-weight:600;vertical-align:1px;color:rgb(var(--tone));background:rgba(var(--tone),.14)}
.hint{color:#c9cdd3;line-height:1.4}
.raw{max-width:100%;margin-top:2px;font:11px/1.4 var(--mono);color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lnk{margin-top:4px;padding:0;background:none;border:0;font:inherit;font-size:11.5px;font-weight:500;color:rgb(var(--tone));cursor:pointer;border-radius:4px}
.lnk::after{content:' →'}
.lnk:hover{text-decoration:underline;text-underline-offset:2px}
.x{flex:none;width:26px;height:26px;margin:-2px -2px 0 0;display:grid;place-items:center;border-radius:50%;border:0;background:rgba(255,255,255,.05);color:var(--dim);cursor:pointer;
  transition:background-color var(--t-fast) var(--ease-out),color var(--t-fast) var(--ease-out),transform var(--t-spring) var(--spring)}
.x:hover{background:rgba(255,255,255,.1);color:var(--ink)}
.x:active{transform:scale(.9)}
.x svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.x:focus-visible,.lnk:focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* Смужка часу життя: тане справа наліво; пауза, поки тост під курсором або у фокусі */
.life{position:absolute;left:0;right:0;bottom:0;height:2px;transform-origin:left;background:linear-gradient(90deg,rgba(var(--tone),.2),rgba(var(--tone),.9));
  animation:kt-life linear forwards}
.toast:hover .life,.toast:focus-within .life{animation-play-state:paused}
@keyframes kt-life{from{transform:scaleX(1)}to{transform:scaleX(0)}}
/* reduce-motion скорочує всі анімації до 0.001 мс — тоді тост закривається лише вручну */
@media(prefers-reduced-motion:reduce){.life{display:none}}

/* Поява — пружно згори з розмиттям; зникнення — стискання; сусіди плавно з'їжджають */
.kt-enter-active{transition:transform var(--t-spring) var(--spring),opacity var(--t-mid) var(--ease-out),filter var(--t-mid) var(--ease-out)}
.kt-leave-active{transition:transform .2s var(--ease-out),opacity .2s var(--ease-out);position:absolute;left:0;right:0}
.kt-move{transition:transform var(--t-spring) var(--spring)}
.kt-enter-from{opacity:0;transform:translateY(-16px) scale(.94);filter:blur(4px)}
.kt-leave-to{opacity:0;transform:scale(.94)}
</style>

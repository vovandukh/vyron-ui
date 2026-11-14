<script setup>
// Картка стану Klipper поверх сцени: shutdown, помилка конфігурації, запуск, служба не запущена.
// Сирий state_message Klipper розбирається (services/klipperErrors.js) у зрозумілий заголовок і «що перевірити»;
// оригінальний текст — у розкривному блоці з копіюванням. Дії: FIRMWARE_RESTART / RESTART / перезапуск служби.
// «Сховати» прибирає картку до кліку по капсулі статусу або до нової помилки.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useUiStore } from '../../stores/uiStore'
import { useI18n } from '../../composables/useI18n'
import Spinner from '../ui/Spinner.vue'
import ErrIcon from '../ui/ErrIcon.vue'

const printer = usePrinterStore()
const ui = useUiStore()
const { t } = useI18n()

const k = computed(() => printer.klippy)
const bad = computed(() => k.value.state === 'shutdown' || k.value.state === 'error')
const pending = computed(() => k.value.state === 'startup' || k.value.state === 'disconnected')

// Короткий startup (RESTART триває ~1–3 с) не блимає карткою: показуємо лише якщо він затягнувся.
// Під час перезапуску з картки — показуємо одразу, щоб було видно прогрес.
const slow = ref(false)
let slowTimer = 0
watch(pending, p => {
  clearTimeout(slowTimer)
  slow.value = false
  if (p) slowTimer = setTimeout(() => { slow.value = true }, 2500)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(slowTimer))

// Нова помилка (інший текст) знову показує сховану картку
watch(() => k.value.state + '|' + k.value.message, () => { if (bad.value) ui.klippyHidden = false })

const live = computed(() => printer.connected || printer.demoMode)
// Після успішного перезапуску картка ще мить показує всі етапи виконаними — і лише тоді зникає
const flash = ref(null)
let flashTimer = 0
watch(() => printer.klippyBusy, (b, o) => {
  clearTimeout(flashTimer)
  if (!b && o && k.value.state === 'ready') { flash.value = o; flashTimer = setTimeout(() => { flash.value = null }, 1200) } else flash.value = null
})
onBeforeUnmount(() => clearTimeout(flashTimer))
const busy = computed(() => printer.klippyBusy || flash.value)
const show = computed(() => live.value && !ui.klippyHidden && (bad.value || !!busy.value || (pending.value && slow.value)))

/** Що показати: { tone, cat, eyebrow, title, hints[], raw } */
const view = computed(() => {
  const s = k.value.state
  if (s === 'startup') return { tone: 'wait', cat: 'wait', eyebrow: 'klippy.eb.startup', title: t('klippy.startup.t'), hints: lines('klippy.startup.h') }
  if (s === 'disconnected') return { tone: 'warn', cat: 'host', eyebrow: 'klippy.eb.offline', title: t('klippy.offline.t'), hints: lines('klippy.offline.h') }
  const i = k.value.info || { id: 'generic', cat: 'generic', params: {}, head: '' }
  const title = i.id === 'generic' ? i.head || t('state.klipperError') : t('kerr.' + i.id + '.t', i.params)
  return { tone: 'err', cat: i.cat, eyebrow: s === 'error' ? 'klippy.eb.error' : 'klippy.eb.shutdown', title, hints: lines('kerr.' + i.id + '.h'), raw: k.value.message, id: i.id }
})
function lines(key) {
  const v = t(key)
  return v === key || !v ? [] : v.split('\n')
}

// Які кнопки: у shutdown — FIRMWARE_RESTART головна (MCU потребують скидання); помилка конфігу — RESTART і перехід до конфігу;
// Klipper не запущений — перезапуск служби.
const acts = computed(() => {
  const s = k.value.state
  if (s === 'disconnected') return { primary: 'service', secondary: null }
  if (s === 'error') return { primary: 'restart', secondary: 'fw' }
  if (s === 'shutdown') return { primary: 'fw', secondary: 'restart' }
  return { primary: null, secondary: null }
})
const LABEL = { fw: ['klippy.fw', 'FIRMWARE_RESTART'], restart: ['klippy.restart', 'RESTART'], service: ['klippy.service', 'systemctl restart klipper'] }

const err = ref('')
async function run(kind) {
  err.value = ''
  try { await printer.klippyAction(kind) } catch (e) { err.value = t('klippy.failed', { msg: (e && e.message) || '' }) }
}

const copied = ref(false)
let copyTimer = 0
async function copy() {
  try {
    await navigator.clipboard.writeText(k.value.message)
  } catch {
    // http:// без secure context — запасний шлях через виділення
    const ta = Object.assign(document.createElement('textarea'), { value: k.value.message })
    document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy') } catch { /* ignore */ }
    ta.remove()
  }
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copied.value = false }, 1600)
}

function openConsole() { ui.klippyHidden = true; ui.go('console') }
function openConfig() { ui.klippyHidden = true; ui.go('cfg') }
const hide = () => { ui.klippyHidden = true }
</script>

<template>
  <Transition name="kc">
    <div v-if="show" class="kc-wrap" :class="'t-' + (flash ? 'ok' : busy ? 'wait' : view.tone)">
      <section class="kc" role="alertdialog" aria-labelledby="kc-title" aria-describedby="kc-hints">
        <button class="x" type="button" :title="t('klippy.hide')" :aria-label="t('klippy.hide')" @click="hide">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>

        <header class="hd">
          <span class="badge" aria-hidden="true">
            <span class="ring"></span>
            <svg v-if="flash" class="okic" viewBox="0 0 16 16"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" /></svg>
            <Spinner v-else-if="view.tone === 'wait' || busy" :size="22" />
            <ErrIcon v-else :cat="view.cat" :size="22" />
          </span>
          <div class="ttl">
            <small class="eb">{{ t(busy ? 'klippy.eb.startup' : view.eyebrow) }}<template v-if="view.tone === 'err' && !busy"> · {{ t('kerr.cat.' + view.cat) }}</template></small>
            <h2 id="kc-title">{{ busy ? t(flash ? 'klippy.restarted' : 'klippy.restarting', { cmd: LABEL[busy][1] }) : view.title }}</h2>
          </div>
        </header>

        <div v-if="view.hints.length && !busy" id="kc-hints" class="hints">
          <b>{{ t('klippy.check') }}</b>
          <ul><li v-for="(h, i) in view.hints" :key="i">{{ h }}</li></ul>
        </div>
        <!-- Під час перезапуску — етапи: зупинка → запуск → готово -->
        <ol v-if="busy" class="steps" aria-live="polite">
          <li :class="{ done: k.state !== 'shutdown' && k.state !== 'error' }">{{ t('klippy.step.stop') }}</li>
          <li :class="{ on: k.state === 'startup' || k.state === 'disconnected', done: k.state === 'ready' }">{{ t('klippy.step.start') }}</li>
          <li :class="{ done: k.state === 'ready' }">{{ t('klippy.step.ready') }}</li>
        </ol>

        <details v-if="view.raw" class="raw">
          <summary>{{ t('klippy.raw') }}</summary>
          <pre>{{ view.raw }}</pre>
          <button type="button" class="cp" @click="copy">{{ t(copied ? 'klippy.copied' : 'klippy.copy') }}</button>
        </details>

        <p v-if="err" class="fail" role="alert">{{ err }}</p>

        <footer class="acts">
          <span class="links">
            <button type="button" class="ghost" @click="openConsole">{{ t('klippy.console') }}</button>
            <button v-if="view.id === 'config' || k.state === 'error'" type="button" class="ghost" @click="openConfig">{{ t('klippy.config') }}</button>
          </span>
          <span class="main">
          <button v-if="acts.secondary" type="button" :disabled="!!printer.klippyBusy" @click="run(acts.secondary)">
            <span>{{ t(LABEL[acts.secondary][0]) }}</span><small>{{ LABEL[acts.secondary][1] }}</small>
          </button>
          <button v-if="acts.primary" type="button" class="primary" :disabled="!!printer.klippyBusy" @click="run(acts.primary)">
            <span>{{ t(LABEL[acts.primary][0]) }}</span><small>{{ LABEL[acts.primary][1] }}</small>
          </button>
          </span>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
/* Обгортка під шапкою: затемнює сцену й ловить кліки (принтер однаково не виконує команд), шапка лишається доступною */
.kc-wrap{position:fixed;left:0;right:0;bottom:0;top:var(--hb,72px);z-index:7;display:grid;place-items:center;padding:16px 16px 24px;overflow:auto;
  background:radial-gradient(ellipse 60% 55% at 50% 50%,rgba(240,58,46,.13),transparent 70%),rgba(6,6,7,.42);
  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.t-wait,.t-warn{background:radial-gradient(ellipse 60% 55% at 50% 50%,rgba(255,159,10,.08),transparent 70%),rgba(6,6,7,.36)}
.kc{--tone:240,58,46;position:relative;width:min(540px,100%);display:grid;gap:16px;padding:22px;border-radius:var(--r-xl);color:var(--ink);font-size:13px;
  background:rgba(20,20,22,.9);border:1px solid;border-color:rgba(var(--tone),.42) rgba(255,255,255,.04) rgba(255,255,255,.03) rgba(var(--tone),.22);
  box-shadow:0 0 0 1px rgba(var(--tone),.08),0 0 60px -18px rgba(var(--tone),.6),0 30px 70px -24px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.05)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
  .kc{background:rgba(20,20,22,.78);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur)}
}
/* Тонкий світний «край» зверху — як розжарена кромка */
.kc::before{content:'';position:absolute;left:22px;right:22px;top:-1px;height:1px;border-radius:1px;
  background:linear-gradient(90deg,transparent,rgba(var(--tone),.95),transparent);box-shadow:0 0 12px rgba(var(--tone),.8)}
.t-warn .kc,.t-wait .kc{--tone:255,159,10}
.t-ok .kc{--tone:52,199,89}
.t-ok{background:radial-gradient(ellipse 60% 55% at 50% 50%,rgba(52,199,89,.08),transparent 70%),rgba(6,6,7,.3)}
.okic{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}

.x{position:absolute;top:12px;right:12px;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;border:0;background:rgba(255,255,255,.05);color:var(--dim);cursor:pointer;
  transition:background-color var(--t-fast) var(--ease-out),color var(--t-fast) var(--ease-out),transform var(--t-spring) var(--spring)}
.x:hover{background:rgba(255,255,255,.1);color:var(--ink)}
.x:active{transform:scale(.9)}
.x svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}

.hd{display:flex;align-items:center;gap:14px;padding-right:34px}
.badge{position:relative;flex:none;width:48px;height:48px;border-radius:15px;display:grid;place-items:center;color:rgb(var(--tone));
  background:radial-gradient(circle at 50% 35%,rgba(var(--tone),.28),rgba(var(--tone),.08));border:1px solid rgba(var(--tone),.35);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 24px -6px rgba(var(--tone),.7)}
/* Пульсуюче кільце: «принтер чекає на тебе» */
.ring{position:absolute;inset:-1px;border-radius:inherit;border:1px solid rgba(var(--tone),.6);animation:kc-ring 2.2s cubic-bezier(.22,1,.36,1) infinite}
@keyframes kc-ring{0%{opacity:.9;transform:scale(1)}70%,100%{opacity:0;transform:scale(1.45)}}
.ttl{min-width:0;display:grid;gap:3px}
.eb{font-size:10.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:rgb(var(--tone))}
h2{margin:0;font-size:17px;font-weight:600;line-height:1.3;letter-spacing:-.005em;overflow-wrap:anywhere}

.hints{display:grid;gap:8px;padding:12px 14px;border-radius:var(--r-md);background:var(--surface);border:1px solid var(--hair)}
.hints b{font-size:11px;font-weight:600;color:var(--dim);letter-spacing:.02em}
.hints ul{margin:0;padding:0;list-style:none;display:grid;gap:7px}
.hints li{position:relative;padding-left:16px;line-height:1.45;color:#d8dbe0}
.hints li::before{content:'';position:absolute;left:2px;top:.6em;width:5px;height:5px;border-radius:50%;background:rgb(var(--tone));box-shadow:0 0 6px rgba(var(--tone),.8)}

.steps{margin:0;padding:12px 14px;list-style:none;display:grid;gap:9px;border-radius:var(--r-md);background:var(--surface);border:1px solid var(--hair);counter-reset:s}
.steps li{display:flex;align-items:center;gap:10px;color:var(--dim);counter-increment:s;transition:color var(--t-mid) var(--ease-out)}
.steps li::before{content:counter(s);flex:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:10.5px;font-weight:600;
  border:1px solid rgba(255,255,255,.14);transition:background-color var(--t-mid) var(--ease-out),border-color var(--t-mid) var(--ease-out),color var(--t-mid) var(--ease-out)}
.steps li.on{color:var(--ink)}
.steps li.on::before{border-color:rgba(255,159,10,.8);color:#ff9f0a;animation:kc-blink 1.1s cubic-bezier(.45,0,.55,1) infinite}
.steps li.done{color:var(--ink)}
.steps li.done::before{content:'✓';background:#34c759;border-color:#34c759;color:#06210f}
@keyframes kc-blink{50%{opacity:.4}}

.raw{border:1px solid var(--hair);border-radius:var(--r-md);background:rgba(0,0,0,.25);overflow:hidden}
.raw summary{padding:10px 14px;cursor:pointer;color:var(--dim);font-size:12px;list-style:none;display:flex;align-items:center;gap:8px;user-select:none;
  transition:color var(--t-fast) var(--ease-out)}
.raw summary::-webkit-details-marker{display:none}
.raw summary::before{content:'';width:6px;height:6px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:rotate(-45deg);transition:transform var(--t-spring) var(--spring)}
.raw[open] summary::before{transform:rotate(45deg);border-color:var(--coral)}
.raw summary:hover,.raw[open] summary{color:var(--ink)}
.raw pre{margin:0;padding:2px 14px 12px;max-height:160px;overflow:auto;font:11.5px/1.55 var(--mono);color:#ff9b91;white-space:pre-wrap;overflow-wrap:anywhere}
.cp{margin:0 14px 12px;padding:6px 12px;font:inherit;font-size:11.5px;color:var(--ink);background:var(--surface-hi);border:1px solid var(--field-bd);border-radius:var(--r-sm);cursor:pointer;
  transition:background-color var(--t-fast) var(--ease-out),transform var(--t-spring) var(--spring)}
.cp:hover{background:rgba(255,255,255,.1)}
.cp:active{transform:scale(.95)}

.fail{margin:-4px 0 0;color:#ff7a6e;font-size:12px}

/* Посилання ліворуч, кнопки перезапуску — праворуч; на вузькій картці кнопки переносяться окремим рядком на всю ширину */
.acts{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.links{display:flex;gap:2px;margin-left:-10px}
.main{flex:1 1 auto;display:flex;justify-content:flex-end;gap:8px}
.acts button{display:grid;justify-items:center;gap:1px;min-height:44px;padding:7px 16px;font:inherit;font-size:13px;font-weight:500;color:var(--ink);cursor:pointer;
  background:var(--surface-hi);border:1px solid var(--field-bd);border-radius:var(--r);
  transition:transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out),filter var(--t-fast) var(--ease-out),opacity var(--t-fast) var(--ease-out)}
.acts button small{font:500 9.5px/1 var(--mono);letter-spacing:.04em;opacity:.65}
.acts button:hover:not(:disabled){background-color:rgba(255,255,255,.1)}
.acts button:active:not(:disabled){transform:scale(.96)}
.acts button:disabled{opacity:.4;cursor:progress}
.acts .ghost{background:none;border-color:transparent;color:var(--dim);display:flex;padding:7px 10px}
.acts .ghost:hover:not(:disabled){color:var(--ink);background:rgba(255,255,255,.06)}
.acts .primary{background:linear-gradient(180deg,#ff5a4c,#e0321f);border-color:transparent;color:#fff;font-weight:600;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 6px 18px -6px rgba(240,58,46,.85)}
.acts .primary:hover:not(:disabled){background:linear-gradient(180deg,#ff6a5c,#e83a27);filter:brightness(1.04)}
.x:focus-visible,.acts button:focus-visible,.cp:focus-visible,.raw summary:focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* Поява: фон проявляється, картка пружно виринає з легким розмиттям */
.kc-enter-active{transition:opacity var(--t-mid) var(--ease-out)}
.kc-enter-active .kc{transition:transform var(--t-spring) var(--spring),opacity var(--t-mid) var(--ease-out),filter var(--t-mid) var(--ease-out)}
.kc-leave-active{transition:opacity .22s var(--ease-out)}
.kc-leave-active .kc{transition:transform .22s var(--ease-out)}
.kc-enter-from,.kc-leave-to{opacity:0}
.kc-enter-from .kc{transform:translateY(14px) scale(.94);opacity:0;filter:blur(4px)}
.kc-leave-to .kc{transform:scale(.96)}

/* Екран 800×480: компактніше, щоб уміщалось без прокрутки */
@media(max-height:620px){
  .kc{gap:12px;padding:16px 18px}
  .badge{width:40px;height:40px;border-radius:13px}
  h2{font-size:15.5px}
  .hints{padding:10px 12px;gap:6px}
  .hints ul{gap:5px}
  .raw pre{max-height:96px}
  .acts button{min-height:40px;padding:6px 14px}
}
@media(max-width:560px){
  .kc{padding:18px 16px}
  .main button{flex:1}
}
</style>

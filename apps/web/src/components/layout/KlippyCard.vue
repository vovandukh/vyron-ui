<script setup>
// Картка стану Klipper поверх сцени: shutdown, помилка конфігурації, запуск, служба не запущена.
// Сирий state_message Klipper розбирається (@vyron/shared/klipper/errors.js) у зрозумілий заголовок і «що перевірити»;
// оригінальний текст — у розкривному блоці з копіюванням. Дії: FIRMWARE_RESTART / RESTART / перезапуск служби.
// «Сховати» прибирає картку до кліку по капсулі статусу або до нової помилки.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { DEMO_BUILD } from '../../config'
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

const live = computed(() => printer.connected || (DEMO_BUILD && printer.demoMode))
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

/** Що показати: { tone, cat, eyebrow, title, desc, hints[], raw } — desc пояснює простими словами, hints — кроки «що зробити» */
const view = computed(() => {
  const s = k.value.state
  if (s === 'startup') return { tone: 'wait', cat: 'wait', eyebrow: 'klippy.eb.startup', title: t('klippy.startup.t'), desc: str('klippy.startup.d'), hints: [] }
  if (s === 'disconnected') return { tone: 'warn', cat: 'host', eyebrow: 'klippy.eb.offline', title: t('klippy.offline.t'), desc: str('klippy.offline.d'), hints: lines('klippy.offline.h') }
  const i = k.value.info || { id: 'generic', cat: 'generic', params: {}, head: '' }
  const title = i.id === 'generic' ? i.head || t('state.klipperError') : t('kerr.' + i.id + '.t', i.params)
  return { tone: 'err', cat: i.cat, eyebrow: s === 'error' ? 'klippy.eb.error' : 'klippy.eb.shutdown', title, desc: str('kerr.' + i.id + '.d'), hints: lines('kerr.' + i.id + '.h'), raw: k.value.message, id: i.id }
})
function str(key) {
  const v = t(key)
  return v === key ? '' : v
}
function lines(key) {
  const v = str(key)
  return v ? v.split('\n') : []
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
      <section class="kc" role="alertdialog" aria-labelledby="kc-title" aria-describedby="kc-desc">
        <button class="x" type="button" :title="t('klippy.hide')" :aria-label="t('klippy.hide')" @click="hide">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>

        <header class="hd">
          <span class="badge" aria-hidden="true">
            <svg v-if="flash" class="okic" viewBox="0 0 16 16"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" /></svg>
            <Spinner v-else-if="view.tone === 'wait' || busy" :size="20" />
            <ErrIcon v-else :cat="view.cat" :size="20" />
          </span>
          <div class="ttl">
            <small class="eb">{{ t(busy ? 'klippy.eb.startup' : view.eyebrow) }}<template v-if="view.tone === 'err' && !busy"><i class="sep">·</i>{{ t('kerr.cat.' + view.cat) }}</template></small>
            <h2 id="kc-title">{{ busy ? t(flash ? 'klippy.restarted' : 'klippy.restarting', { cmd: LABEL[busy][1] }) : view.title }}</h2>
          </div>
        </header>

        <p v-if="view.desc && !busy" id="kc-desc" class="desc">{{ view.desc }}</p>

        <div v-if="view.hints.length && !busy" class="hints">
          <b>{{ t('klippy.check') }}</b>
          <ol><li v-for="(h, i) in view.hints" :key="i">{{ h }}</li></ol>
        </div>
        <!-- Під час перезапуску — етапи: зупинка → запуск → готово -->
        <ol v-if="busy" class="steps" aria-live="polite">
          <li :class="{ done: k.state !== 'shutdown' && k.state !== 'error' }">{{ t('klippy.step.stop') }}</li>
          <li :class="{ on: k.state === 'startup' || k.state === 'disconnected', done: k.state === 'ready' }">{{ t('klippy.step.start') }}</li>
          <li :class="{ done: k.state === 'ready' }">{{ t('klippy.step.ready') }}</li>
        </ol>

        <details v-if="view.raw && !busy" class="raw">
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
            <!-- Технічна назва команди — у підказці: користувачу досить зрозумілої дії -->
            <button v-if="acts.secondary" type="button" :title="LABEL[acts.secondary][1]" :disabled="!!printer.klippyBusy" @click="run(acts.secondary)">{{ t(LABEL[acts.secondary][0]) }}</button>
            <button v-if="acts.primary" type="button" class="primary" :title="LABEL[acts.primary][1]" :disabled="!!printer.klippyBusy" @click="run(acts.primary)">{{ t(LABEL[acts.primary][0]) }}</button>
          </span>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
/* Обгортка під шапкою: рівно притемнює сцену й ловить кліки (принтер однаково не виконує команд), шапка лишається доступною */
.kc-wrap{position:fixed;left:0;right:0;bottom:0;top:var(--hb,72px);z-index:7;display:flex;padding:16px 16px 24px;overflow:auto;
  background:rgba(8,8,10,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
/* margin:auto — «безпечне» центрування: висока картка прокручується, а не обрізається згори */
.kc{--tone:255,69,58;position:relative;margin:auto;width:min(520px,100%);min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:16px;padding:22px 22px 18px;border-radius:var(--r-xl);color:var(--ink);font-size:13px;overflow:hidden;
  background:rgba(24,24,27,calc(1 - 0.06 * var(--glass-t,1)));border:1px solid rgba(255,255,255,.08);
  box-shadow:0 28px 70px -24px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.04)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
  .kc{background:rgba(24,24,27,calc(1 - 0.14 * var(--glass-t,1)));-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur)}
}
/* Тонка смуга кольору згори — єдиний кольоровий акцент картки */
.kc::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;background:rgb(var(--tone))}
.t-warn .kc,.t-wait .kc{--tone:255,159,10}
.t-ok .kc{--tone:52,199,89}
.okic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

.x{position:absolute;top:14px;right:14px;width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:0;background:none;color:var(--dim);cursor:pointer;
  transition:background-color var(--t-fast) var(--ease-out),color var(--t-fast) var(--ease-out)}
.x:hover{background:rgba(255,255,255,.08);color:var(--ink)}
.x svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}

.hd{display:flex;align-items:center;gap:14px;padding-right:32px}
.badge{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:rgb(var(--tone));background:rgba(var(--tone),.12)}
.ttl{min-width:0;display:grid;gap:3px}
.eb{font-size:12px;font-weight:500;color:rgb(var(--tone))}
.sep{font-style:normal;margin:0 6px;color:var(--dim)}
h2{margin:0;font-size:18px;font-weight:600;line-height:1.3;letter-spacing:-.01em;overflow-wrap:anywhere}
.desc{margin:-4px 0 0;font-size:13.5px;line-height:1.55;color:#c3c6cc}

/* «Що зробити» — нумеровані кроки з нейтральними кружечками */
.hints{display:grid;gap:10px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)}
.hints b{font-size:12px;font-weight:600;color:var(--ink)}
.hints ol{margin:0;padding:0;list-style:none;display:grid;gap:8px;counter-reset:h}
.hints li{position:relative;padding-left:30px;line-height:1.5;color:#d4d7dc;counter-increment:h;min-height:20px}
.hints li::before{content:counter(h);position:absolute;left:0;top:0;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;
  font-size:11px;font-weight:600;color:var(--ink);background:rgba(255,255,255,.08)}

.steps{margin:0;padding:0;list-style:none;display:grid;gap:10px;counter-reset:s}
.steps li{display:flex;align-items:center;gap:10px;color:var(--dim);counter-increment:s;transition:color var(--t-mid) var(--ease-out)}
.steps li::before{content:counter(s);flex:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:600;
  background:rgba(255,255,255,.08);transition:background-color var(--t-mid) var(--ease-out),color var(--t-mid) var(--ease-out)}
.steps li.on{color:var(--ink)}
.steps li.on::before{color:#ff9f0a;background:rgba(255,159,10,.16);animation:kc-blink 1.2s ease-in-out infinite}
.steps li.done{color:var(--ink)}
.steps li.done::before{content:'✓';background:#34c759;color:#06210f}
@keyframes kc-blink{50%{opacity:.45}}

.raw{border-radius:var(--r-md);background:rgba(255,255,255,.035);overflow:hidden}
.raw summary{padding:10px 12px;cursor:pointer;color:var(--dim);font-size:12px;list-style:none;display:flex;align-items:center;gap:8px;user-select:none;
  transition:color var(--t-fast) var(--ease-out)}
.raw summary::-webkit-details-marker{display:none}
.raw summary::before{content:'';width:5px;height:5px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform var(--t-fast) var(--ease-out)}
.raw[open] summary::before{transform:rotate(45deg)}
.raw summary:hover,.raw[open] summary{color:var(--ink)}
.raw pre{margin:0;padding:0 12px 10px;max-height:160px;overflow:auto;font:11.5px/1.55 var(--mono);color:#a9adb5;white-space:pre-wrap;overflow-wrap:anywhere}
.cp{margin:0 12px 12px;padding:5px 10px;font:inherit;font-size:11.5px;color:var(--ink);background:rgba(255,255,255,.07);border:0;border-radius:var(--r-sm);cursor:pointer;
  transition:background-color var(--t-fast) var(--ease-out)}
.cp:hover{background:rgba(255,255,255,.12)}

.fail{margin:-4px 0 0;color:#ff7a6e;font-size:12px}

/* Дії — рядок кнопок на всю ширину (головна праворуч); під ним тихі посилання на консоль і налаштування */
.acts{display:grid;gap:4px;margin-top:2px}
.main{display:flex;flex-wrap:wrap;gap:8px}
.main button{flex:1 1 160px}
.links{order:2;display:flex;flex-wrap:wrap;gap:2px;margin-left:-10px}
.acts button{min-height:40px;padding:0 16px;font:inherit;font-size:13px;font-weight:500;color:var(--ink);cursor:pointer;
  background:rgba(255,255,255,.07);border:0;border-radius:var(--r);
  transition:background-color var(--t-fast) var(--ease-out),opacity var(--t-fast) var(--ease-out),transform var(--t-fast) var(--ease-out)}
.acts button:hover:not(:disabled){background-color:rgba(255,255,255,.12)}
.acts button:active:not(:disabled){transform:scale(.98)}
.acts button:disabled{opacity:.4;cursor:progress}
.acts .ghost{min-height:34px;background:none;color:var(--dim);padding:0 10px;font-size:12.5px}
.acts .ghost:hover:not(:disabled){color:var(--ink);background:rgba(255,255,255,.06)}
/* Головна дія — світла кнопка: помітна без кричущого кольору */
.acts .primary{background:#f2f2f4;color:#111113;font-weight:600}
.acts .primary:hover:not(:disabled){background:#fff}
.x:focus-visible,.acts button:focus-visible,.cp:focus-visible,.raw summary:focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* Поява: фон проявляється, картка трохи підіймається */
.kc-enter-active{transition:opacity .22s var(--ease-out)}
.kc-enter-active .kc{transition:transform .28s var(--ease-out),opacity .22s var(--ease-out)}
.kc-leave-active{transition:opacity .18s var(--ease-out)}
.kc-enter-from,.kc-leave-to{opacity:0}
.kc-enter-from .kc{transform:translateY(10px);opacity:0}

/* Екран 800×480: компактніше, щоб уміщалось без прокрутки */
@media(max-height:620px){
  .kc{gap:12px;padding:16px 18px 14px}
  .badge{width:36px;height:36px;border-radius:10px}
  h2{font-size:16px}
  .desc{font-size:12.5px;line-height:1.45}
  .hints{padding-top:10px;gap:7px}
  .hints ol{gap:5px}
  .raw pre{max-height:96px}
  .acts button{min-height:38px;padding:0 14px}
}
@media(max-width:560px){
  .kc{padding:18px 16px 14px}
}
</style>

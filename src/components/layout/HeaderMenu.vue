<script setup>
// Центр керування (у дусі macOS Control Center): підключення до принтера, демо-режим і меню системи.
// Відкривається лише кнопкою «…» — стан у ui.cc.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useUiStore } from '../../stores/uiStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'
import { normalizeHost, savedHost, resolveHost } from '../../services/moonrakerClient'
import { DEMO_BUILD } from '../../config'

const printer = usePrinterStore()
const ui = useUiStore()
const { ask } = useConfirm()
const { t, tm } = useI18n()

const btn = ref(null)
const onDoc = () => ui.closeCc()
const onKey = e => {
  if (e.key !== 'Escape' || !ui.cc) return
  ui.closeCc()
  btn.value?.focus()
}
onMounted(() => { document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey) })

// ---------- підключення ----------
const host = ref(printer.host || savedHost() || '')
watch(() => printer.host, h => { if (h) host.value = h })

function connect() {
  const h = normalizeHost(host.value)
  if (!h) return
  host.value = h
  printer.connect(h, { remember: true })
}
/** Адреса, до якої підключено (або буде підключено) — для показу на принтері */
const shownHost = computed(() => printer.host || resolveHost())
/** Заголовок плитки: на принтері — сам стан з'єднання («Підключено»), у демо-збірці — «Підключення» */
const LINK_TITLE = { open: 'cc.connected', ready: 'cc.connected', shutdown: 'cc.connected', connecting: 'state.connecting', lost: 'state.lost' }
const linkTitle = computed(() => (DEMO_BUILD ? 'cc.connection' : LINK_TITLE[printer.link] || 'cc.notConnected'))
const toggleDemo = () => (printer.demoMode ? printer.exitDemo() : printer.startDemo())

// ---------- демо: імітація помилок Klipper (лише в демо-збірці та в демо-режимі) ----------
// Стан Klipper — картка з причиною й перезапуском; G-code — тости. Види — як у printer.demoError().
const DEMO_ERR = [
  { g: 'klippy', items: ['mcu', 'timer', 'heater', 'adc', 'estop', 'config', 'startup', 'offline'] },
  { g: 'gcode', items: ['home', 'range', 'cold', 'probe', 'qgl', 'macro', 'unknown'] }
]
const errOpen = ref(false)
function demoErr(kind, group) {
  ui.closeCc()
  // Сховану картку повертає лише нова помилка стану Klipper; G-code помилка — тільки тост (як на справжньому принтері)
  if (group === 'klippy') ui.klippyHidden = false
  printer.demoError(kind)
}

// ---------- меню ----------
function nav(v) { ui.go(v) }

const SYS = {
  mr: { label: 'menu.restartMoonraker', confirm: 'confirm.restartMoonraker', method: 'machine.services.restart', params: { service: 'moonraker' } },
  reboot: { label: 'menu.reboot', confirm: 'confirm.reboot', method: 'machine.reboot' },
  off: { label: 'menu.shutdown', confirm: 'confirm.shutdown', method: 'machine.shutdown' }
}
async function sys(k) {
  ui.closeCc()
  const a = SYS[k]
  if (await ask(a.confirm)) printer.call(a.method, a.params || {}).catch(() => {})
}

// Панель пружно «виростає» з кнопки «…».
// offsetLeft/Top, а не getBoundingClientRect: на момент @enter уже діє scale із .cc-enter-from.
function onEnter(el) {
  const c = ui.cc || {}
  const x = (c.x ?? el.offsetLeft + el.offsetWidth) - el.offsetLeft
  const y = (c.y ?? el.offsetTop) - el.offsetTop - 10
  el.style.transformOrigin = `${Math.round(x)}px ${Math.round(y)}px`
}
</script>

<template>
  <div class="mnu">
    <button ref="btn" class="mbtn" aria-haspopup="dialog" :aria-expanded="String(!!ui.cc)" :aria-label="t('cc.open')"
            @click.stop="ui.toggleCc($event.currentTarget)">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="19" cy="12" r="1.7" fill="currentColor" /></svg>
    </button>

    <Transition name="cc" @enter="onEnter">
      <div v-if="ui.cc" class="cc glass" role="dialog" :aria-label="t('cc.title')" :style="{ top: ui.cc.y + 10 + 'px' }" @click.stop>
        <section class="tile">
          <div class="tile-hd">
            <span class="dot" :class="'l-' + printer.link"></span>
            <b>{{ t(linkTitle) }}</b>
            <span class="st">{{ tm(printer.stateLabel) }}</span>
          </div>
          <!-- На принтері інтерфейс бере адресу зі сторінки сам — лише показуємо її; ручне підключення — тільки в демо-збірці -->
          <form v-if="DEMO_BUILD" class="host" @submit.prevent="connect">
            <input v-model="host" :placeholder="t('conn.placeholder')" :aria-label="t('conn.aria')"
                   autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url">
            <button type="submit" class="pri" :disabled="printer.link === 'connecting'">{{ t('conn.connect') }}</button>
          </form>
          <div v-else class="hostRo">
            <small>{{ t('cc.address') }}</small>
            <b :title="shownHost">{{ shownHost || t('island.noHost') }}</b>
          </div>
          <!-- Перемикач демо — лише в демо-збірці (GitHub Pages); у збірці для принтера демо немає -->
          <button v-if="DEMO_BUILD" type="button" class="tgl" role="switch" :aria-checked="String(printer.demoMode)" @click="toggleDemo">
            <span class="tgl-tx"><b>{{ t('cc.demo') }}</b><small>{{ t('cc.demoHint') }}</small></span>
            <span class="sw" :class="{ on: printer.demoMode }" aria-hidden="true"><i></i></span>
          </button>
          <!-- Імітація помилок: розкривається, щоб не роздувати центр керування -->
          <template v-if="DEMO_BUILD && printer.demoMode">
            <button type="button" class="tgl derr-hd" :aria-expanded="String(errOpen)" @click="errOpen = !errOpen">
              <span class="tgl-tx"><b>{{ t('cc.demoErr') }}</b><small>{{ t('cc.demoErrHint') }}</small></span>
              <span class="chev" :class="{ on: errOpen }" aria-hidden="true"></span>
            </button>
            <Transition name="derr">
              <div v-if="errOpen" class="derr">
                <div v-for="grp in DEMO_ERR" :key="grp.g" class="dg">
                  <small>{{ t('demoErr.g.' + grp.g) }}</small>
                  <div class="chips">
                    <button v-for="k in grp.items" :key="k" type="button" :class="'c-' + grp.g" @click="demoErr(k, grp.g)">{{ t('demoErr.' + k) }}</button>
                  </div>
                </div>
              </div>
            </Transition>
          </template>
        </section>

        <div class="list" role="menu">
          <button role="menuitem" @click="nav('set')">{{ t('menu.settings') }}</button>
          <button role="menuitem" @click="nav('upd')">{{ t('menu.updates') }}</button>
          <button role="menuitem" @click="nav('net')">{{ t('menu.net') }}</button>
          <hr>
          <button v-for="(a, k) in SYS" :key="k" role="menuitem" :disabled="printer.isPrinting" @click="sys(k)">{{ t(a.label) }}</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mnu{position:relative;pointer-events:auto}
.mbtn{background:rgba(20,20,22,.6);border:1px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);color:var(--ink);width:34px;height:34px;border-radius:50%;cursor:pointer;display:grid;place-items:center;
  transition:transform var(--t-spring) var(--spring),color var(--t-fast) var(--ease-out),background-color var(--t-fast) var(--ease-out)}
.mbtn:hover{color:var(--coral);background:rgba(40,40,44,.7)}
.mbtn:active{transform:scale(.9)}
.mbtn[aria-expanded="true"]{color:var(--coral);background:rgba(255,255,255,.1)}

/* ---------- панель ---------- */
.cc{position:fixed;right:32px;width:min(320px,calc(100vw - 32px));max-height:calc(100vh - 90px);overflow:auto;padding:10px;border-radius:22px;display:grid;grid-template-columns:minmax(0,1fr);gap:8px;z-index:30;text-align:left;color:var(--ink);font-size:13px;letter-spacing:0}
.tile{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.05);border-radius:16px;padding:12px;display:grid;gap:10px}
.tile-hd{display:flex;align-items:center;gap:8px;font-size:13px}
.tile-hd b{font-weight:600}
.tile-hd .st{margin-left:auto;color:var(--dim);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%}
.dot{width:8px;height:8px;border-radius:50%;background:var(--dim);flex:none}
.dot.l-open,.dot.l-ready{background:#34c759;box-shadow:0 0 8px rgba(52,199,89,.6)}
.dot.l-demo{background:var(--blue);box-shadow:0 0 8px rgba(120,156,255,.6)}
.dot.l-connecting{background:#ff9f0a;animation:blink 1.1s cubic-bezier(.45,0,.55,1) infinite}
.dot.l-lost,.dot.l-shutdown{background:var(--red);box-shadow:0 0 8px rgba(240,58,46,.6)}
@keyframes blink{50%{opacity:.3}}

.host{display:flex;gap:6px}
/* Адреса принтера лише для читання (збірка для принтера) */
.hostRo{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:11px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.06)}
.hostRo small{color:var(--dim);font-size:11px;white-space:nowrap}
.hostRo b{font:500 13px/1.2 var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.host input{flex:1;width:0;min-width:0;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.08);color:var(--ink);font:inherit;font-size:13px;padding:9px 11px;border-radius:11px;
  transition:border-color var(--t-fast) var(--ease-out),box-shadow var(--t-fast) var(--ease-out)}
.host input:focus{outline:none;border-color:rgba(255,107,90,.7);box-shadow:0 0 0 3px rgba(255,107,90,.18)}
.pri{flex:none;border:0;border-radius:11px;padding:0 14px;font:inherit;font-size:13px;font-weight:500;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,#ff5a4c,#e0321f);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 4px 14px -6px rgba(240,58,46,.8);
  transition:transform var(--t-spring) var(--spring),filter var(--t-fast) var(--ease-out)}
.pri:hover:not(:disabled){filter:brightness(1.08)}
.pri:active:not(:disabled){transform:scale(.95)}
.pri:disabled{opacity:.5;cursor:wait}

/* Перемикач у стилі iOS: увесь рядок — одна кнопка role=switch */
.tgl{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;background:none;border:0;padding:2px 0;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:10px}
.tgl-tx{display:grid;gap:2px}
.tgl-tx b{font-weight:500;font-size:13px}
.tgl-tx small{color:var(--dim);font-size:11px}
.sw{flex:none;position:relative;width:44px;height:26px;border-radius:13px;background:rgba(255,255,255,.14);transition:background-color var(--t-mid) var(--ease-out)}
.sw i{position:absolute;top:2px;left:2px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transition:transform var(--t-spring) var(--spring),width var(--t-fast) var(--ease-out)}
.sw.on{background:#34c759}
.sw.on i{transform:translateX(18px)}
.tgl:active .sw i{width:26px}
.tgl:active .sw.on i{transform:translateX(14px)}

/* Імітація помилок (демо): шеврон розкриття і «чипи» видів помилок */
.derr-hd{padding-top:10px;border-top:1px solid rgba(255,255,255,.06);border-radius:0}
.chev{flex:none;width:8px;height:8px;margin-right:8px;border-right:1.6px solid var(--dim);border-bottom:1.6px solid var(--dim);transform:rotate(45deg);
  transition:transform var(--t-spring) var(--spring),border-color var(--t-fast) var(--ease-out)}
.chev.on{transform:rotate(-135deg);border-color:var(--coral)}
.derr{display:grid;gap:10px}
.dg{display:grid;gap:6px}
.dg small{color:var(--dim);font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chips button{font:inherit;font-size:11.5px;padding:6px 10px;border-radius:999px;cursor:pointer;color:var(--ink);
  transition:transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out),border-color var(--t-fast) var(--ease-out)}
.chips .c-klippy{background:rgba(240,58,46,.1);border:1px solid rgba(240,58,46,.32)}
.chips .c-klippy:hover{background:rgba(240,58,46,.2);border-color:rgba(240,58,46,.6)}
.chips .c-gcode{background:rgba(255,159,10,.08);border:1px solid rgba(255,159,10,.3)}
.chips .c-gcode:hover{background:rgba(255,159,10,.17);border-color:rgba(255,159,10,.6)}
.chips button:active{transform:scale(.93)}
.chips button:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
.derr-enter-active{transition:opacity var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.derr-leave-active{transition:opacity .14s var(--ease-out)}
.derr-enter-from{opacity:0;transform:translateY(-6px)}
.derr-leave-to{opacity:0}

.list{display:grid;gap:1px;padding:2px}
.list button{background:none;border:0;color:var(--ink);font:inherit;font-size:13px;text-align:left;padding:10px 12px;border-radius:11px;cursor:pointer;
  transition:background-color var(--t-fast) var(--ease-out),transform var(--t-spring) var(--spring)}
.list button:hover:not(:disabled){background:rgba(255,255,255,.07)}
.list button:active:not(:disabled){transform:scale(.98);background:rgba(255,255,255,.1)}
.list button:disabled{opacity:.35;cursor:not-allowed}
.list hr{border:0;border-top:1px solid rgba(255,255,255,.07);margin:4px 8px;width:auto}
.mbtn:focus-visible,.list button:focus-visible,.tgl:focus-visible,.pri:focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* Поява — пружина масштабування від кнопки-джерела; зникнення — коротке і без перельоту */
.cc-enter-active{transition:transform var(--t-spring) var(--spring),opacity var(--t-fast) var(--ease-out)}
.cc-leave-active{transition:transform .2s var(--ease-out),opacity .16s var(--ease-out)}
.cc-enter-from{opacity:0;transform:scale(.55)}
.cc-leave-to{opacity:0;transform:scale(.9)}

@media(max-width:900px){.cc{right:16px}}
</style>

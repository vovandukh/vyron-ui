<script setup>
// Демо-збірка (GitHub Pages): частина плитки «Підключення» в центрі керування — ручне підключення до принтера
// в мережі з підказкою, перемикач демо-режиму і його налаштування (голови, стіл, стан друку, імітація помилок).
// HeaderMenu підключає компонент лише в демо-збірці, тож у збірку для принтера він не потрапляє.
import { ref, computed, watch } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useUiStore } from '../../stores/uiStore'
import { useI18n } from '../../composables/useI18n'
import { normalizeHost, savedHost, mixedContentRisk } from '@vyron/shared/moonraker/client'
import { DEMO_MAX_TOOLS } from '../../services/demo'

const printer = usePrinterStore()
const ui = useUiStore()
const { t } = useI18n()

// ---------- підключення ----------
const host = ref(printer.host || savedHost() || '')
watch(() => printer.host, h => { if (h) host.value = h })
// Демо на https: після невдалої спроби підключитись до принтера в мережі — підказка, що дозволити
const tried = ref(false)
const origin = location.origin
const showHelp = computed(() => tried.value && !printer.demoMode && mixedContentRisk(normalizeHost(host.value)) &&
  !['open', 'ready', 'shutdown', 'connecting'].includes(printer.link))
function connect() {
  const h = normalizeHost(host.value)
  if (!h) return
  tried.value = true
  host.value = h
  printer.connect(h, { remember: true })
}
const toggleDemo = () => (printer.demoMode ? printer.exitDemo() : printer.startDemo())

// ---------- налаштування демо ----------
const HEADS = Array.from({ length: Math.min(6, DEMO_MAX_TOOLS) }, (_, i) => i + 1)
const BEDS = ['rect', 'round']
const DEMO_STATES = ['printing', 'paused', 'complete', 'idle']
const demoStateOf = () => { const s = printer.printState; return s === 'standby' || !s ? 'idle' : s }

// Імітація помилок Klipper: стан Klipper — картка з причиною й перезапуском; G-code — тости
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
</script>

<template>
  <form class="host" @submit.prevent="connect">
    <input v-model="host" :placeholder="t('conn.placeholder')" :aria-label="t('conn.aria')"
           autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url">
    <button type="submit" class="pri" :disabled="printer.link === 'connecting'">{{ t('conn.connect') }}</button>
  </form>
  <div v-if="showHelp" class="help" role="note">
    <b>{{ t('conn.help.t') }}</b>
    <ol><li>{{ t('conn.help.1') }}</li><li>{{ t('conn.help.2', { origin }) }}</li><li>{{ t('conn.help.3') }}</li></ol>
    <small>{{ t('conn.help.alt') }}</small>
  </div>
  <button type="button" class="tgl" role="switch" :aria-checked="String(printer.demoMode)" @click="toggleDemo">
    <span class="tgl-tx"><b>{{ t('cc.demo') }}</b><small>{{ t('cc.demoHint') }}</small></span>
    <span class="sw" :class="{ on: printer.demoMode }" aria-hidden="true"><i></i></span>
  </button>
  <template v-if="printer.demoMode">
    <div class="heads">
      <small>{{ t('cc.heads') }}</small>
      <div class="hseg" role="radiogroup" :aria-label="t('cc.heads')">
        <button v-for="n in HEADS" :key="n" type="button" role="radio" :aria-checked="String(printer.toolCount === n)" :class="{ on: printer.toolCount === n }" @click="printer.startDemo(n)">{{ n }}</button>
      </div>
    </div>
    <!-- Форма столу: прямокутний або круглий (дельта) -->
    <div class="heads">
      <small>{{ t('cc.bed') }}</small>
      <div class="hseg" role="radiogroup" :aria-label="t('cc.bed')">
        <button v-for="b in BEDS" :key="b" type="button" role="radio" :aria-checked="String(printer.demoBed === b)" :class="{ on: printer.demoBed === b }" @click="printer.setDemoBed(b)">{{ t('cc.bed.' + b) }}</button>
      </div>
    </div>
    <!-- Стан демо-друку: побачити і «готово», і очікування, а не лише нескінченний друк -->
    <div class="heads">
      <small>{{ t('cc.demoState') }}</small>
      <div class="hseg" role="radiogroup" :aria-label="t('cc.demoState')">
        <button v-for="s in DEMO_STATES" :key="s" type="button" role="radio" :aria-checked="String(demoStateOf() === s)" :class="{ on: demoStateOf() === s }" @click="printer.demoSet(s)">{{ t('cc.ds.' + s) }}</button>
      </div>
    </div>
    <!-- Імітація помилок: розкривається, щоб не роздувати центр керування -->
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
</template>

<style scoped>
.host{display:flex;gap:6px}
.host input{flex:1;width:0;min-width:0;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.08);color:var(--ink);font:inherit;font-size:13px;padding:9px 11px;border-radius:var(--r);
  transition:border-color var(--t-fast) var(--ease-out),box-shadow var(--t-fast) var(--ease-out)}
.host input:focus{outline:none;border-color:rgba(var(--accent-rgb),.7);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.18)}
.pri{flex:none;border:0;border-radius:var(--r);padding:0 14px;font:inherit;font-size:13px;font-weight:500;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,var(--btn-hi),var(--btn-lo));box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 4px 14px -6px rgba(var(--brand-rgb),.8);
  transition:transform var(--t-spring) var(--spring),filter var(--t-fast) var(--ease-out)}
.pri:hover:not(:disabled){filter:brightness(1.08)}
.pri:active:not(:disabled){transform:scale(.95)}
.pri:disabled{opacity:.5;cursor:wait}
.help{display:grid;gap:6px;padding:10px 12px;border-radius:var(--r);background:rgba(255,159,10,.1);border:1px solid rgba(255,159,10,.25);font-size:12px;line-height:1.45;color:#ffd9a0}
.help b{color:#ffcf85;font-size:12.5px}
.help ol{margin:0;padding-left:18px;display:grid;gap:4px}
.help small{color:var(--dim);font-size:11.5px}
.heads{display:grid;gap:6px}
.heads small{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em}
.hseg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;padding:2px;border-radius:9px;background:rgba(118,118,128,.24)}
.hseg button{border:0;background:none;color:var(--ink);font:inherit;font-size:12.5px;font-weight:600;padding:6px 0;border-radius:7px;cursor:pointer}
.hseg button.on{background:rgba(255,255,255,.16);box-shadow:0 1px 3px rgba(0,0,0,.35)}

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
.tgl:focus-visible,.pri:focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* Імітація помилок: шеврон розкриття і «чипи» видів помилок */
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
</style>

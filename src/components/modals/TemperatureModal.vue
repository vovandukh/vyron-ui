<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useUiStore } from '../../stores/uiStore'
import { useI18n } from '../../composables/useI18n'
import { toolNum } from '../../services/klipper'

const TP = {
  nozzle: { title: 'temp.nozzle', max: 320, pre: [200, 230, 260, 280] },
  bed: { title: 'temp.bed', max: 130, pre: [60, 80, 100, 110] }
}

const printer = usePrinterStore()
const ui = useUiStore()
const { t, tm } = useI18n()

const inp = ref(null)
const value = ref('')
const msg = ref(null)

const cfg = computed(() => TP[ui.tempModal] || null)
/** Вибрана голова у вікні сопла (за замовчуванням — активна). Перемикач показується лише коли голів > 1. */
const tool = ref(null)
const tools = computed(() => printer.toolObjects)
const heater = computed(() => (ui.tempModal === 'bed' ? 'heater_bed' : tool.value || printer.nozzleHeater))
/** Вікно сопла, але Klipper ще не повідомив жодної голови — поля не показуємо. */
const noTools = computed(() => ui.tempModal === 'nozzle' && !tools.value.length)
const h = computed(() => printer.st[heater.value] || {})
const deg = v => (v != null ? Math.round(v) + '°' : '–')

function fillFromTarget() {
  value.value = h.value.target ? Math.round(h.value.target) : ''
  msg.value = null
  nextTick(() => { inp.value?.focus(); inp.value?.select() })
}

// При відкритті поле заповнюється поточною ціллю (один раз, не під час набору).
watch(() => ui.tempModal, k => {
  if (!k) return
  tool.value = k === 'nozzle' ? printer.activeToolName || tools.value[0] || null : null
  fillFromTarget()
})

function pickTool(name) {
  tool.value = name
  fillFromTarget()
}

const close = () => { ui.tempModal = null }

function send(v) {
  const c = cfg.value
  const empty = value.value === '' || value.value == null
  v = Number(v)
  if (!heater.value) return
  if ((empty && v !== 0) || !(v >= 0 && v <= c.max)) { msg.value = { key: 'temp.range', params: { max: c.max } }; return }
  if (printer.demoMode) { close(); return }
  if (!printer.connected) { msg.value = { key: 'msg.notConnectedPrinter' }; return }
  printer.setHeater(heater.value, v).then(close).catch(e => { msg.value = { raw: e.message } })
}

function off() { value.value = 0; send(0) }

const onKey = e => { if (e.key === 'Escape' && ui.tempModal) close() }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="modal">
  <div v-if="cfg" class="tp modal-back" @click.self="close">
    <div class="tpb modal" role="dialog" aria-modal="true" aria-labelledby="tpt">
      <div id="tpt" class="tpt">{{ t(cfg.title) }}</div>
      <div v-if="ui.tempModal === 'nozzle' && tools.length > 1" class="tpt-tools" role="tablist" :style="{ '--n': Math.min(tools.length, 6) }">
        <button v-for="n in tools" :key="n" role="tab" :aria-selected="n === tool" :class="{ on: n === tool }" @click="pickTool(n)">
          T{{ toolNum(n) }}<small>{{ deg((printer.st[n] || {}).temperature) }}</small>
        </button>
      </div>
      <template v-if="noTools">
        <div class="tpempty">{{ t('tools.none') }}</div>
        <div class="tpa one"><button @click="close">{{ t('common.cancel') }}</button></div>
      </template>
      <template v-else>
        <div class="tpcur">{{ t('temp.now') }} <b>{{ deg(h.temperature) }}</b> · {{ t('temp.target') }} <b>{{ deg(h.target) }}</b></div>
        <input ref="inp" v-model="value" class="tpin" type="number" min="0" :max="cfg.max" step="1" inputmode="numeric" :aria-label="t('temp.aria')" @keydown.enter="send(value)">
        <div class="tpp"><button v-for="p in cfg.pre" :key="p" @click="value = p">{{ p }}°</button></div>
        <div class="tpmsg">{{ tm(msg) }}</div>
        <div class="tpa">
          <button @click="off">{{ t('common.off') }}</button>
          <button @click="close">{{ t('common.cancel') }}</button>
          <button class="tpset primary" @click="send(value)">{{ t('common.set') }}</button>
        </div>
      </template>
    </div>
  </div>
  </Transition>
</template>

<style scoped>
.tpb{width:min(340px,92vw);gap:12px}
.tpt{font-size:15px;font-weight:500}
/* Рівна сітка: до 6 голів в один ряд, далі — такими ж комірками в наступних рядах */
.tpt-tools{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:6px}
.tpb .tpt-tools button{min-width:0;min-height:0;padding:7px 2px;font-size:12px;line-height:1.2}
.tpt-tools button small{display:block;font-size:10px;color:var(--dim)}
.tpb .tpt-tools button.on{border-color:rgba(var(--accent-rgb),.55);background:rgba(var(--accent-rgb),.14)}
.tpcur{font-size:12px;color:var(--dim)}
.tpcur b{color:var(--ink);font-weight:300;font-size:14px}
.tpin{font-size:28px;font-weight:200;text-align:center;padding:10px;-moz-appearance:textfield;appearance:textfield}
.tpin::-webkit-inner-spin-button,.tpin::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.tpp{display:flex;gap:8px}
.tpp button{flex:1;border-radius:999px}
.tpa{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:8px}
.tpmsg{color:var(--coral);font-size:12px;min-height:14px}
.tpempty{color:var(--dim);font-size:13px;line-height:1.5}
.tpa.one{grid-template-columns:1fr}
</style>

<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useUiStore } from '../../stores/uiStore'
import { useI18n } from '../../composables/useI18n'

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
const heater = computed(() => (ui.tempModal === 'bed' ? 'heater_bed' : printer.nozzleHeater))
const h = computed(() => printer.st[heater.value] || {})
const deg = v => (v != null ? Math.round(v) + '°' : '–')

// При відкритті поле заповнюється поточною ціллю (один раз, не під час набору).
watch(() => ui.tempModal, k => {
  if (!k) return
  value.value = h.value.target ? Math.round(h.value.target) : ''
  msg.value = null
  nextTick(() => { inp.value?.focus(); inp.value?.select() })
})

const close = () => { ui.tempModal = null }

function send(v) {
  const c = cfg.value
  const empty = value.value === '' || value.value == null
  v = Number(v)
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
  <div v-if="cfg" class="tp" @click.self="close">
    <div class="tpb" role="dialog" aria-modal="true" aria-labelledby="tpt">
      <div id="tpt" class="tpt">{{ t(cfg.title) }}</div>
      <div class="tpcur">{{ t('temp.now') }} <b>{{ deg(h.temperature) }}</b> · {{ t('temp.target') }} <b>{{ deg(h.target) }}</b></div>
      <input ref="inp" v-model="value" class="tpin" type="number" min="0" :max="cfg.max" step="1" inputmode="numeric" :aria-label="t('temp.aria')" @keydown.enter="send(value)">
      <div class="tpp"><button v-for="p in cfg.pre" :key="p" @click="value = p">{{ p }}°</button></div>
      <div class="tpmsg">{{ tm(msg) }}</div>
      <div class="tpa">
        <button @click="off">{{ t('common.off') }}</button>
        <button @click="close">{{ t('common.cancel') }}</button>
        <button class="tpset" @click="send(value)">{{ t('common.set') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tp{position:fixed;inset:0;z-index:12;background:rgba(0,0,0,.6);display:grid;place-items:center}
.tpb{width:min(340px,92vw);background:rgba(14,15,17,.98);border:1px solid var(--line);border-radius:10px;padding:18px;display:grid;gap:12px}
.tpt{font-size:15px;font-weight:500}
.tpcur{font-size:12px;color:var(--dim)}
.tpcur b{color:var(--ink);font-weight:300;font-size:14px}
.tpin{background:none;border:1px solid var(--line);color:var(--ink);font:inherit;font-size:26px;font-weight:200;text-align:center;border-radius:8px;padding:10px;-moz-appearance:textfield;appearance:textfield}
.tpin::-webkit-inner-spin-button,.tpin::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.tpp{display:flex;gap:8px}
.tpp button{flex:1}
.tpb button{background:none;border:1px solid var(--line);color:var(--ink);font:inherit;font-size:13px;border-radius:8px;padding:12px 10px;min-height:44px;cursor:pointer}
.tpb button:hover{border-color:var(--red)}
.tpb .tpset{background:#d42a20;border-color:#d42a20;color:#fff;font-weight:600}
.tpa{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:8px}
.tpmsg{color:var(--red);font-size:12px;min-height:14px}
.tpb :focus-visible{outline:2px solid var(--red);outline-offset:2px}
</style>

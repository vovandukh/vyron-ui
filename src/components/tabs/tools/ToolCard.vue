<script setup>
import { computed, ref, watch } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useI18n } from '../../../composables/useI18n'

const props = defineProps({ index: { type: Number, required: true } })
const MAX_T = 320
const BOARD_HOT = 75

const printer = usePrinterStore()
const { t } = useI18n()

const name = computed(() => printer.toolObjects[props.index] || null)
const ob = computed(() => (name.value ? printer.st[name.value] || {} : {}))
const temp = computed(() => ob.value.temperature)
const target = computed(() => ob.value.target)

const board = computed(() => {
  const n = printer.boardObjects[props.index]
  const v = n ? (printer.st[n] || {}).temperature : null
  return { found: printer.demoMode || !!n, v: v == null ? null : Number(v) }
})

// Поле вводу підхоплює ціль із принтера, але не перезаписується під час набору.
const input = ref(target.value ?? '')
watch(target, v => { input.value = v ?? '' })

function heat() {
  const v = Number(input.value)
  if (input.value === '' || !Number.isFinite(v) || v < 0 || v > MAX_T) { printer.toolStatus = { key: 'tools.badTemp' }; return }
  printer.setToolTarget(props.index, v)
}
</script>

<template>
  <div class="toolcard" :class="{ selected: index === printer.activeTool }">
    <div class="toolhead"><strong>TOOL {{ index }}</strong><span class="muted">{{ name || t('tools.cardNotFound') }}</span></div>
    <div class="temp">{{ temp == null ? '–' : Number(temp).toFixed(1) + '°' }} <small>/ {{ target == null ? '–' : Math.round(target) + '°C' }}</small></div>
    <div class="muted">{{ name ? t('tools.tempOf', { name }) : t('tools.addSection', { sec: index === 0 ? '[extruder]' : '[extruder' + index + ']' }) }}</div>
    <div class="muted">{{ t('tools.board') }}
      <span v-if="!board.found">{{ t('tools.noSensor') }}</span>
      <span v-else :class="{ hot: board.v != null && board.v >= BOARD_HOT }">{{ board.v == null ? '–' : board.v.toFixed(1) + '°' }}</span>
    </div>
    <input v-model="input" type="number" min="0" :max="MAX_T" step="1" :placeholder="t('tools.placeholder')" :aria-label="t('tools.aria', { i: index })" :disabled="!name" @keydown.enter="heat">
    <div class="actions">
      <button :disabled="!name" @click="heat">{{ t('common.set') }}</button>
      <button :disabled="!name" @click="printer.setToolTarget(index, 0)">{{ t('common.off') }}</button>
      <button :disabled="!name" @click="printer.selectTool(index)">{{ t('tools.activate') }}</button>
    </div>
  </div>
</template>

<style scoped>
.toolcard{border:1px solid var(--line);border-radius:8px;padding:13px;display:grid;gap:9px;background:rgba(255,255,255,.015)}
.toolcard.selected{border-color:rgba(240,58,46,.7)}
.toolhead{display:flex;justify-content:space-between;align-items:center}
.toolhead strong{font-size:14px;font-weight:500}
.temp{font-size:26px;font-weight:200}
.temp small{font-size:12px;color:var(--dim)}
.toolcard input{width:100%}
.actions{display:flex;gap:7px}
.actions button{flex:1}
.hot{color:var(--red)}
</style>

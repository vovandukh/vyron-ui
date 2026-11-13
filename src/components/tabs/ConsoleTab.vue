<script setup>
import { ref, watch, nextTick, onActivated } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useI18n } from '../../composables/useI18n'

const printer = usePrinterStore()
const { t, tm } = useI18n()

const logEl = ref(null), inp = ref(null)
const cmd = ref('')
let hi = printer.cmdHistory.length

const scrollDown = () => nextTick(() => { if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight })
watch(() => printer.consoleLines.length && printer.consoleLines[printer.consoleLines.length - 1].id, scrollDown)
onActivated(() => { scrollDown(); inp.value?.focus() })

function submit() {
  const c = cmd.value.trim()
  if (!c) return
  printer.consoleSend(c)
  hi = printer.cmdHistory.length
  cmd.value = ''
}

function onKey(e) {
  const h = printer.cmdHistory
  if (e.key === 'Enter') submit()
  else if (e.key === 'ArrowUp' && hi > 0) { cmd.value = h[--hi]; e.preventDefault() }
  else if (e.key === 'ArrowDown') { cmd.value = hi < h.length - 1 ? h[++hi] : ''; hi = Math.min(hi, h.length); e.preventDefault() }
}
</script>

<template>
  <section class="view">
    <div ref="logEl" class="log" aria-live="polite">
      <div v-for="l in printer.consoleLines" :key="l.id" :class="l.cls">{{ l.msg ? tm(l.msg) : l.text }}</div>
    </div>
    <div class="row">
      <input ref="inp" v-model="cmd" class="cin" :placeholder="t('console.placeholder')" autocomplete="off" spellcheck="false" @keydown="onKey">
      <button @click="submit">{{ t('console.send') }}</button>
    </div>
  </section>
</template>

<style scoped>
.cin{flex:1}
</style>

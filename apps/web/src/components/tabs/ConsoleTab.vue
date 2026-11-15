<script setup>
import { ref, computed, watch, nextTick, onActivated } from 'vue'
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

// Рядок логу → клас кольору: команда / коментар Klipper (//) / помилка (!!) / звичайна відповідь
const kind = l => {
  if (l.cls) return l.cls
  const s = l.text || ''
  return s.startsWith('!!') ? 'e' : s.startsWith('//') ? 'k' : ''
}
// Префікс '> ' у командах замінює кораловий '›' з CSS
const text = l => (l.msg ? tm(l.msg) : l.cls === 'c' ? String(l.text).replace(/^> /, '') : l.text)

const macros = computed(() => [
  { cmd: 'G28', label: 'G28', motion: true },
  printer.leveling ? { cmd: printer.leveling.kind === 'ztilt' ? 'Z_TILT_ADJUST' : 'QUAD_GANTRY_LEVEL', label: printer.leveling.kind === 'ztilt' ? 'Z-Tilt' : 'QGL', motion: true } : null,
  { cmd: 'BED_MESH_CALIBRATE', label: 'Mesh', motion: true },
  { cmd: 'M114', label: 'M114' },
  { cmd: 'M84', label: 'M84', motion: true }
].filter(Boolean))

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
      <div v-for="l in printer.consoleLines" :key="l.id" :class="kind(l)">{{ text(l) }}</div>
    </div>
    <!-- Швидкі макроси: тактильні скляні пігулки; рухові команди недоступні під час друку -->
    <div class="macros" role="toolbar" :aria-label="t('console.macros')">
      <button v-for="m in macros" :key="m.cmd" class="pill" :disabled="m.motion && printer.isPrinting" :title="m.cmd" @click="printer.consoleSend(m.cmd)">{{ m.label }}</button>
    </div>
    <div class="cbar">
      <input ref="inp" v-model="cmd" class="cin" :placeholder="t('console.placeholder')" autocomplete="off" spellcheck="false" autocapitalize="off" @keydown="onKey">
      <button class="primary" @click="submit">{{ t('console.send') }}</button>
    </div>
  </section>
</template>

<style scoped>
.macros{display:flex;gap:6px;flex-wrap:wrap}
.view .pill{border-radius:999px;padding:7px 14px;font:500 11px/1 var(--mono);letter-spacing:.02em}
.cbar{display:flex;gap:8px}
.view .cin{flex:1;min-width:0;font-family:var(--mono);font-size:13px;padding:11px 14px}
.cbar .primary{padding:0 18px}
</style>

<script setup>
import { usePrinterStore } from '../../stores/printerStore'
import { useI18n } from '../../composables/useI18n'
import ToolCard from './tools/ToolCard.vue'

const printer = usePrinterStore()
const { t, tm } = useI18n()
</script>

<template>
  <section class="view">
    <div class="row">
      <strong>{{ t('tools.title') }}</strong>
      <span>{{ tm(printer.toolStatus) }}</span>
      <details class="hint">
        <summary>{{ t('tools.hintSummary') }}</summary>
        <pre>[temperature_sensor ebb_t0]
sensor_type: temperature_mcu
sensor_mcu: ebb0   {{ t('tools.hintMcu') }}
{{ t('tools.hintSame') }}</pre>
        <p>{{ t('tools.hintText') }}</p>
      </details>
      <span class="muted">{{ t('tools.selectHint') }}</span>
    </div>
    <div class="toolgrid">
      <ToolCard v-for="i in 6" :key="i" :index="i - 1" />
    </div>
    <div class="muted">{{ t('tools.footer') }}</div>
  </section>
</template>

<style scoped>
.toolgrid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px}
.hint{margin-top:8px}
.hint summary{cursor:pointer;color:var(--dim);font-size:13px}
.hint pre{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:7px;padding:12px;overflow:auto;font:12px/1.5 var(--mono)}
.hint p{color:var(--dim);font-size:12px}
@media(max-width:900px){.toolgrid{grid-template-columns:repeat(2,minmax(140px,1fr))}}
@media(max-width:560px){.toolgrid{grid-template-columns:1fr 1fr}}
</style>

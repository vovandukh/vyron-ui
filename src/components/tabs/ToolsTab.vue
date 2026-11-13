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
        <p>{{ t('tools.hintText') }}</p>
        <pre>[temperature_sensor EBBCan_mcu]
sensor_type: temperature_mcu
sensor_mcu: EBBCan   {{ t('tools.hintMcu') }}</pre>
      </details>
      <span v-if="printer.canSwitchTools" class="muted">{{ t('tools.selectHint') }}</span>
    </div>
    <!-- Рівно стільки карток, скільки екструдерів знайдено (1…N) -->
    <div v-if="printer.toolCount" class="toolgrid">
      <ToolCard v-for="(name, i) in printer.toolObjects" :key="name" :name="name" :index="i" />
    </div>
    <!-- 0 голів: ще немає відповіді Klipper або немає підключення -->
    <div v-else class="empty">
      <div class="empty-t">{{ t('tools.none') }}</div>
      <div class="muted">{{ t(printer.connected ? 'tools.noneConnected' : 'tools.noneOffline') }}</div>
    </div>
    <div v-if="printer.canSwitchTools" class="muted">{{ t('tools.footer') }}</div>
  </section>
</template>

<style scoped>
/* auto-fill: одна голова не розтягується на всю ширину, 2/4/6 розкладаються рівною сіткою */
.toolgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:10px}
.empty{border:1px dashed var(--line);border-radius:8px;padding:28px 18px;display:grid;gap:6px;justify-items:center;text-align:center}
.empty-t{font-size:15px;font-weight:300}
.hint{margin-top:8px}
.hint summary{cursor:pointer;color:var(--dim);font-size:13px}
.hint pre{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:7px;padding:12px;overflow:auto;font:12px/1.5 var(--mono)}
.hint p{color:var(--dim);font-size:12px}
</style>

<script setup>
import { usePrinterStore } from '../../stores/printerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'

const printer = usePrinterStore()
const settings = useSettingsStore()
const { confirm } = useConfirm()
const { t } = useI18n()

async function stop() {
  if (settings.cEstop && !(await confirm('estop.confirm'))) return
  printer.emergencyStop()
}
</script>

<template>
  <button class="estop" :aria-label="t('estop.label')" :title="t('estop.title')" @click="stop">STOP</button>
</template>

<style scoped>
.estop{background:#d42a20;color:#fff;border:0;height:34px;padding:0 12px;border-radius:7px;font:inherit;font-size:11px;font-weight:600;letter-spacing:.08em;cursor:pointer}
.estop:hover{background:#f03a2e}
.estop:focus-visible{outline:2px solid #fff;outline-offset:2px}
</style>

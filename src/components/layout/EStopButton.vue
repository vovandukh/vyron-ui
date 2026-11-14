<script setup>
import { computed } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'

const printer = usePrinterStore()
const settings = useSettingsStore()
const { confirm } = useConfirm()
const { t } = useI18n()

// Під час друку кнопка повільно «дихає» червоним світінням — аварійна зупинка завжди на виду.
const live = computed(() => printer.printState === 'printing')

async function stop() {
  if (settings.cEstop && !(await confirm('estop.confirm'))) return
  printer.emergencyStop()
}
</script>

<template>
  <button class="estop" :class="{ live }" :aria-label="t('estop.label')" :title="t('estop.title')" @click="stop">STOP</button>
</template>

<style scoped>
.estop{position:relative;color:#fff;border:0;height:34px;padding:0 14px;border-radius:17px;font:inherit;font-size:11px;font-weight:700;letter-spacing:.1em;cursor:pointer;
  background:linear-gradient(180deg,#ef3b2f,#c4231a);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(0,0,0,.25),0 4px 14px -6px rgba(240,58,46,.9);
  transition:transform var(--t-spring) var(--spring),filter var(--t-fast) var(--ease-out)}
.estop:hover{filter:brightness(1.12)}
.estop:active{transform:scale(.92);filter:brightness(.95)}
.estop:focus-visible{outline:2px solid #fff;outline-offset:2px}
/* Дихання: повільна синусоїда зовнішнього світіння (кнопка маленька — перемальовування тіні дешеве) */
.estop.live{animation:breathe 3.6s cubic-bezier(.45,0,.55,1) infinite}
@keyframes breathe{
  0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(0,0,0,.25),0 0 0 0 rgba(240,58,46,0),0 4px 14px -6px rgba(240,58,46,.9)}
  50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(0,0,0,.25),0 0 0 4px rgba(240,58,46,.16),0 0 22px 2px rgba(240,58,46,.55)}
}
</style>

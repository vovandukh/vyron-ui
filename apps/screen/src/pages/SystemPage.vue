<script setup>
// Система: перезапуски Klipper / Moonraker і хоста. Кожна дія — з підтвердженням; під час друку
// все, що перериває друк, вимкнене.
import { ref } from 'vue'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Row from '../components/Row.vue'
import ConfirmSheet from '../components/ConfirmSheet.vue'

const p = usePrinter()
const ACTIONS = {
  restart: { label: 'klippy.restart', ask: 'eng.confirmRestart', run: () => p.restart(), icon: 'restart', color: 'var(--blue)' },
  fw: { label: 'klippy.fw', ask: 'eng.confirmFw', run: () => p.firmwareRestart(), icon: 'chip', color: 'var(--purple)' },
  moonraker: { label: 'menu.restartMoonraker', ask: 'confirm.restartMoonraker', run: () => p.restartMoonraker(), icon: 'refresh', color: 'var(--teal)' },
  reboot: { label: 'menu.reboot', ask: 'confirm.reboot', run: () => p.reboot(), icon: 'host', color: 'var(--amber)' },
  shutdown: { label: 'menu.shutdown', ask: 'confirm.shutdown', run: () => p.shutdown(), icon: 'power', color: 'var(--red)' }
}
const ask = ref('')
function ok() { ACTIONS[ask.value].run(); ask.value = '' }
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.system') }}</h1>
    <div class="grp">
      <Row v-for="id in ['restart', 'fw', 'moonraker']" :key="id" :icon="ACTIONS[id].icon" :color="ACTIONS[id].color"
           :label="t(ACTIONS[id].label)" :disabled="p.active" @tap="ask = id" />
    </div>
    <div class="grp">
      <Row v-for="id in ['reboot', 'shutdown']" :key="id" :icon="ACTIONS[id].icon" :color="ACTIONS[id].color"
           :label="t(ACTIONS[id].label)" :danger="id === 'shutdown'" :disabled="p.active" @tap="ask = id" />
    </div>
    <p class="grp-f">{{ t(p.active ? 'scr.sysBusy' : 'scr.sysHint') }}</p>
    <ConfirmSheet v-if="ask" :text="t(ACTIONS[ask].ask)" :ok="t(ACTIONS[ask].label)" :cancel="t('common.cancel')" @ok="ok" @cancel="ask = ''" />
  </div>
</template>

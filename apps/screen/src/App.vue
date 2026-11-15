<script setup>
// Vyron Screen: верхня смуга завжди; під нею — підключення, помилка Klipper або головний екран.
import { computed, onMounted, ref } from 'vue'
import { usePrinter } from './store'
import { t } from './i18n'
import TopBar from './components/TopBar.vue'
import HomeView from './components/HomeView.vue'
import ErrorView from './components/ErrorView.vue'
import ConfirmSheet from './components/ConfirmSheet.vue'

const p = usePrinter()
onMounted(() => p.start())

const view = computed(() => {
  if (p.link !== 'open') return 'wait'
  return p.klippy.state === 'ready' ? 'home' : 'error'
})

/** Підтвердження: 'cancel' (скасувати друк) | 'stop' (аварійна зупинка) */
const ask = ref('')
function confirmed() {
  if (ask.value === 'cancel') p.cancel()
  else if (ask.value === 'stop') p.estop()
  ask.value = ''
}
</script>

<template>
  <TopBar @stop="ask = 'stop'" />
  <main v-if="view === 'wait'" class="wait">
    <b>{{ t(p.link === 'idle' ? 'scr.noHost' : p.link === 'lost' ? 'conn.lost' : 'scr.connecting') }}</b>
    <span v-if="p.host">{{ p.host }}</span>
  </main>
  <ErrorView v-else-if="view === 'error'" />
  <HomeView v-else @cancel="ask = 'cancel'" />

  <ConfirmSheet v-if="ask === 'cancel'" :text="t('print.cancelConfirm')" :ok="t('print.cancelOk')" @ok="confirmed" @cancel="ask = ''" />
  <ConfirmSheet v-if="ask === 'stop'" :text="t('estop.confirm')" ok="STOP" :cancel="t('common.cancel')" @ok="confirmed" @cancel="ask = ''" />
</template>

<style scoped>
.wait{height:calc(100% - 4.6rem);display:grid;place-content:center;justify-items:center;gap:.8rem;text-align:center;padding:2rem}
.wait b{font-size:1.8rem;font-weight:600}
.wait span{font-size:1.3rem;color:var(--dim)}
</style>

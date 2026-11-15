<script setup>
// Vyron Screen: верхня смуга завжди; під нею — підключення, помилка Klipper або поточна сторінка (стек навігації).
import { computed, onMounted, ref } from 'vue'
import { usePrinter } from './store'
import { watchBuild } from '@vyron/shared/live'
import { t } from './i18n'
import TopBar from './components/TopBar.vue'
import HomeView from './components/HomeView.vue'
import ErrorView from './components/ErrorView.vue'
import ConfirmSheet from './components/ConfirmSheet.vue'
import SettingsPage from './pages/SettingsPage.vue'
import WifiPage from './pages/WifiPage.vue'
import ThemePage from './pages/ThemePage.vue'
import LanguagePage from './pages/LanguagePage.vue'
import AboutPage from './pages/AboutPage.vue'
import SystemPage from './pages/SystemPage.vue'
import UpdatesPage from './pages/UpdatesPage.vue'
import MovePage from './pages/MovePage.vue'

const PAGES = { settings: SettingsPage, wifi: WifiPage, theme: ThemePage, language: LanguagePage, about: AboutPage, system: SystemPage, updates: UpdatesPage, move: MovePage }

const p = usePrinter()
onMounted(() => p.start())
// Нова версія на принтері (Update Manager): тихо перезавантажуємось, коли на екрані головна і ніхто її не торкається
watchBuild({ canReload: () => p.page === 'home' && !ask.value && !p.busy && !p.moving })

const view = computed(() => {
  if (p.page !== 'home') return 'page'
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
  <Transition :name="p.dir">
    <component :is="PAGES[p.page]" v-if="view === 'page'" :key="p.page" />
    <div v-else-if="view === 'wait'" key="wait" class="page wait">
      <b>{{ t(p.link === 'idle' ? 'scr.noHost' : p.link === 'lost' ? 'conn.lost' : 'scr.connecting') }}</b>
      <span v-if="p.host">{{ p.host }}</span>
    </div>
    <ErrorView v-else-if="view === 'error'" key="error" />
    <HomeView v-else key="home" @cancel="ask = 'cancel'" />
  </Transition>

  <ConfirmSheet v-if="ask === 'cancel'" :text="t('print.cancelConfirm')" :ok="t('print.cancelOk')" @ok="confirmed" @cancel="ask = ''" />
  <ConfirmSheet v-if="ask === 'stop'" :text="t('estop.confirm')" ok="STOP" :cancel="t('common.cancel')" @ok="confirmed" @cancel="ask = ''" />
</template>

<style scoped>
.wait{display:grid;place-content:center;justify-items:center;gap:.8rem;text-align:center;padding:2rem}
.wait b{font-size:1.8rem;font-weight:600}
.wait span{font-size:1.3rem;color:var(--dim)}
</style>

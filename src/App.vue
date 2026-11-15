<script setup>
import { computed, onMounted, watch } from 'vue'
import { usePrinterStore } from './stores/printerStore'
import { useUiStore } from './stores/uiStore'
import { useSettingsStore } from './stores/settingsStore'
import { chime } from './services/sound'

import PrintPreview3D from './components/viz/PrintPreview3D.vue'
import BackdropFx from './components/viz/BackdropFx.vue'
import AppHeader from './components/layout/AppHeader.vue'
import ProgressBar from './components/layout/ProgressBar.vue'
import KlippyCard from './components/layout/KlippyCard.vue'
import KlipperToasts from './components/layout/KlipperToasts.vue'

import ControlTab from './components/tabs/ControlTab.vue'
import ConsoleTab from './components/tabs/ConsoleTab.vue'
import BedMeshTab from './components/tabs/BedMeshTab.vue'
import HistoryTab from './components/tabs/HistoryTab.vue'
import EngineeringMenu from './components/tabs/EngineeringMenu.vue'

import SettingsModal from './components/modals/SettingsModal.vue'
import UpdatesModal from './components/modals/UpdatesModal.vue'
import WifiModal from './components/modals/WifiModal.vue'
import TemperatureModal from './components/modals/TemperatureModal.vue'
import ConfirmModal from './components/modals/ConfirmModal.vue'

const printer = usePrinterStore()
const ui = useUiStore()

// Панелі поверх 3D-сцени. «Керування» (main) — сама сцена з елементами керування.
const panels = {
  console: ConsoleTab, mesh: BedMeshTab, hist: HistoryTab, eng: EngineeringMenu,
  set: SettingsModal, upd: UpdatesModal, net: WifiModal
}
const panel = computed(() => panels[ui.view] || null)

onMounted(() => printer.autoStart())

// Звук подій (Налаштування → Сповіщення): друк завершено / друк обірвався / Klipper зупинився
const settings = useSettingsStore()
watch(() => printer.printState, (s, o) => {
  if (!settings.sound || !o || s === o) return
  if (s === 'complete' && o === 'printing') chime('done')
  else if (s === 'error') chime('error')
})
watch(() => printer.klippy.state, (s, o) => { if (settings.sound && o && s !== o && (s === 'shutdown' || s === 'error')) chime('error') })
</script>

<template>
  <BackdropFx />
  <PrintPreview3D />
  <AppHeader />
  <!-- «Керування» — лише прозорість: transform на обгортці зламав би position:fixed її дітей -->
  <Transition name="ctl">
    <ControlTab v-show="ui.view === 'main'" />
  </Transition>
  <!-- KeepAlive зберігає стан вкладок (зокрема незбережені правки конфігу) між перемиканнями.
       Явний :key обов'язковий: інакше v-if дає всім панелям автоматичний key=0 і кеш KeepAlive плутає їх.
       Transition іззовні KeepAlive (так вимагає Vue): панелі перетікають fade + легким зсувом на пружині. -->
  <Transition name="pane">
    <KeepAlive>
      <component :is="panel" v-if="panel" :key="ui.view" />
    </KeepAlive>
  </Transition>
  <ProgressBar />
  <!-- Помилки Klipper: картка стану (shutdown / конфіг / запуск) і тости помилок G-code -->
  <KlippyCard />
  <KlipperToasts />
  <TemperatureModal />
  <ConfirmModal />
</template>

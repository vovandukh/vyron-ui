<script setup>
import { computed, onMounted } from 'vue'
import { usePrinterStore } from './stores/printerStore'
import { useUiStore } from './stores/uiStore'

import PrintPreview3D from './components/viz/PrintPreview3D.vue'
import AppHeader from './components/layout/AppHeader.vue'
import ConnectionBar from './components/layout/ConnectionBar.vue'
import ProgressBar from './components/layout/ProgressBar.vue'

import ControlTab from './components/tabs/ControlTab.vue'
import ToolsTab from './components/tabs/ToolsTab.vue'
import ConsoleTab from './components/tabs/ConsoleTab.vue'
import BedMeshTab from './components/tabs/BedMeshTab.vue'
import HistoryTab from './components/tabs/HistoryTab.vue'
import EngineeringTab from './components/tabs/EngineeringTab.vue'
import ConfigTab from './components/tabs/ConfigTab.vue'

import SettingsModal from './components/modals/SettingsModal.vue'
import UpdatesModal from './components/modals/UpdatesModal.vue'
import WifiModal from './components/modals/WifiModal.vue'
import TemperatureModal from './components/modals/TemperatureModal.vue'
import ConfirmModal from './components/modals/ConfirmModal.vue'

const printer = usePrinterStore()
const ui = useUiStore()

// Панелі поверх 3D-сцени. «Керування» (main) — сама сцена з елементами керування.
const panels = {
  tools: ToolsTab, console: ConsoleTab, mesh: BedMeshTab, hist: HistoryTab, eng: EngineeringTab, cfg: ConfigTab,
  set: SettingsModal, upd: UpdatesModal, net: WifiModal
}
const panel = computed(() => panels[ui.view] || null)

onMounted(() => printer.autoStart())
</script>

<template>
  <PrintPreview3D />
  <AppHeader />
  <ControlTab v-show="ui.view === 'main'" />
  <ConnectionBar />
  <!-- KeepAlive зберігає стан вкладок (зокрема незбережені правки конфігу) між перемиканнями.
       Явний :key обов'язковий: інакше v-if дає всім панелям автоматичний key=0 і кеш KeepAlive плутає їх. -->
  <KeepAlive>
    <component :is="panel" v-if="panel" :key="ui.view" />
  </KeepAlive>
  <ProgressBar />
  <TemperatureModal />
  <ConfirmModal />
</template>

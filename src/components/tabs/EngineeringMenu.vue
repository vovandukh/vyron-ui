<script setup>
// «Інженерне меню»: одна вкладка замість «Інженерне» + «Конфіг».
// Сегментний перемикач зверху; обраний підрозділ живе в ui.engSection усю сесію.
// Обидва підрозділи лишаються змонтованими (v-show) — незбережені правки конфігу не губляться.
import { ref, computed, onActivated, onDeactivated } from 'vue'
import { useUiStore } from '../../stores/uiStore'
import { useI18n } from '../../composables/useI18n'
import SegmentedControl from '../ui/SegmentedControl.vue'
import EngineeringTab from './EngineeringTab.vue'
import ConfigTab from './ConfigTab.vue'

const ui = useUiStore()
const { t } = useI18n()

const sections = computed(() => [
  { value: 'sys', label: t('eng.secSys') },
  { value: 'cfg', label: t('eng.secCfg') }
])
const visible = ref(true)
onActivated(() => { visible.value = true })
onDeactivated(() => { visible.value = false })
</script>

<template>
  <section class="view">
    <SegmentedControl v-model="ui.engSection" :options="sections" :aria-label="t('nav.eng')" />
    <!-- Анімується лише поява підрозділу: старий зникає миттєво, щоб вони не накладались -->
    <Transition name="sec">
      <EngineeringTab v-if="ui.engSection === 'sys'" :active="visible" />
    </Transition>
    <!-- Конфігурація лише ховається (v-show): відкритий файл і правки зберігаються між перемиканнями -->
    <Transition name="sec">
      <ConfigTab v-show="ui.engSection === 'cfg'" />
    </Transition>
  </section>
</template>

<style scoped>
.sec-enter-active{transition:opacity var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.sec-enter-from{opacity:0;transform:translateY(6px)}
</style>

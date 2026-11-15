<script setup>
// Корінь налаштувань (як «Параметри» iOS): групи рядків з кольоровими іконками й поточними значеннями.
import { computed, onMounted, ref } from 'vue'
import { usePrinter } from '../store'
import { t, lang, LANGS } from '../i18n'
import { wlanSummary } from '../net'
import Row from '../components/Row.vue'

const p = usePrinter()
const net = ref('')
onMounted(async () => {
  p.refreshUpdates(false)
  try { net.value = wlanSummary((await p.call('machine.system_info')).system_info) } catch { net.value = '' }
})
const langName = computed(() => (LANGS.find(l => l.id === lang.value) || {}).name)
const theme = computed(() => t('design.p.' + p.design.preset))
/** Кількість доступних оновлень (перевірка — локальний статус Moonraker, без звернень до git) */
const updValue = computed(() => {
  const n = Object.entries(p.updates.info || {}).filter(([k, v]) => (k === 'system' ? v.package_count > 0 : (v.commits_behind || []).length > 0 || (v.remote_version && v.version && v.remote_version !== v.version))).length
  return n ? String(n) : ''
})
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.settings') }}</h1>
    <div class="grp">
      <Row icon="wifi" :label="t('scr.page.wifi')" :value="net" chevron @tap="p.go('wifi')" />
    </div>
    <div class="grp">
      <Row icon="palette" :label="t('scr.page.theme')" :value="theme" chevron @tap="p.go('theme')" />
      <Row icon="globe" :label="t('scr.page.language')" :value="langName" chevron @tap="p.go('language')" />
    </div>
    <div class="grp">
      <Row icon="refresh" :label="t('scr.page.updates')" :value="updValue" chevron @tap="p.go('updates')" />
      <Row icon="info" :label="t('scr.page.about')" chevron @tap="p.go('about')" />
      <Row icon="power" :label="t('scr.page.system')" chevron @tap="p.go('system')" />
    </div>
  </div>
</template>

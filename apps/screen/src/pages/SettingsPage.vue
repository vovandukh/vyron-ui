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
  try { net.value = wlanSummary((await p.call('machine.system_info')).system_info) } catch { net.value = '' }
})
const langName = computed(() => (LANGS.find(l => l.id === lang.value) || {}).name)
const theme = computed(() => t('design.p.' + p.design.preset))
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.settings') }}</h1>
    <div class="grp">
      <Row icon="wifi" color="var(--blue)" :label="t('scr.page.wifi')" :value="net" chevron @tap="p.go('wifi')" />
    </div>
    <div class="grp">
      <Row icon="palette" color="var(--brand)" :label="t('scr.page.theme')" :value="theme" chevron @tap="p.go('theme')" />
      <Row icon="globe" color="var(--green)" :label="t('scr.page.language')" :value="langName" chevron @tap="p.go('language')" />
    </div>
    <div class="grp">
      <Row icon="info" color="var(--gray)" :label="t('scr.page.about')" chevron @tap="p.go('about')" />
      <Row icon="power" color="var(--red)" :label="t('scr.page.system')" chevron @tap="p.go('system')" />
    </div>
  </div>
</template>

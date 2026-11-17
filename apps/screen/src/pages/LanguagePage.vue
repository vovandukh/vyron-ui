<script setup>
import { t, lang, LANGS } from '../i18n'
import Row from '../components/Row.vue'
import { usePrinter } from '../store'

const p = usePrinter()
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.language') }}</h1>
    <div class="grp">
      <Row v-for="l in LANGS" :key="l.id" :label="l.name" :check="lang === l.id" @tap="p.setLang(l.id)" />
    </div>
    <p class="grp-f">{{ t('scr.langHint') }}</p>
  </div>
</template>

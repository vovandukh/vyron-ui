<script setup>
// Тема: кольорові пресети Vyron. Вибір застосовується одразу й записується у спільну базу Moonraker —
// вебінтерфейс та інші екрани підхоплюють його (миттєво, якщо працює Vyron Core).
import { PRESETS } from '@vyron/shared/theme'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from '../components/Icon.vue'

const p = usePrinter()
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.theme') }}</h1>
    <div class="grp sw-grid">
      <button v-for="x in PRESETS" :key="x.id" type="button" class="sw tap" :class="{ on: p.design.preset === x.id }" @click="p.setPreset(x.id)">
        <span class="dot" :style="{ background: `linear-gradient(135deg, ${x.accent}, ${x.brand})` }">
          <Icon v-if="p.design.preset === x.id" name="check" size="1.8rem" :stroke="3" />
        </span>
        <span class="nm">{{ t('design.p.' + x.id) }}</span>
      </button>
    </div>
    <p class="grp-f">{{ t('scr.themeHint') }}</p>
  </div>
</template>

<style scoped>
.sw-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:.6rem;padding:1.2rem .8rem}
.sw{display:grid;justify-items:center;gap:.5rem;padding:.4rem 0;border-radius:var(--r-sm)}
.dot{width:4.2rem;height:4.2rem;border-radius:50%;display:grid;place-items:center;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
.sw.on .dot{box-shadow:0 0 0 .25rem var(--bg),0 0 0 .45rem rgba(255,255,255,.85)}
.nm{font-size:1.1rem;color:var(--dim);white-space:nowrap}
.sw.on .nm{color:var(--ink);font-weight:600}
</style>

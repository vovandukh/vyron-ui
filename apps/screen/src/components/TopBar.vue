<script setup>
// Верхня смуга. На головній — знак Vyron і стан принтера; на інших сторінках — «‹ Назад» з назвою попередньої (як в iOS),
// а назва поточної — великим заголовком на самій сторінці.
// STOP завжди на місці в правому куті: аварійна зупинка доступна з будь-якої сторінки.
import { computed } from 'vue'
import { logoSvg } from '@vyron/shared/logo'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from './Icon.vue'
import StatusPill from './StatusPill.vue'

const emit = defineEmits(['stop'])
const p = usePrinter()

const sub = computed(() => p.page !== 'home')
const prev = computed(() => p.stack[p.stack.length - 2])
const LOGO = logoSvg('var(--brand)', { fx: true })
</script>

<template>
  <header class="tb">
    <template v-if="!sub">
      <span class="logo" aria-hidden="true" v-html="LOGO"></span>
      <StatusPill />
    </template>
    <template v-else>
      <button type="button" class="bk tap" @click="p.back()">
        <Icon name="back" size="2rem" :stroke="2.6" /><span>{{ t('scr.page.' + prev) }}</span>
      </button>
    </template>
    <button type="button" class="stop tap" :aria-label="t('estop.label')" @click="emit('stop')">STOP</button>
  </header>
</template>

<style scoped>
.tb{position:relative;height:4.6rem;display:flex;align-items:center;gap:.9rem;padding:0 1rem 0 1.3rem}
.logo{display:block;width:3rem;height:3rem;flex:none}
/* «‹ Назад» — акцентним кольором теми, як системна кнопка iOS */
.bk{flex:none;display:flex;align-items:center;gap:.1rem;height:3.6rem;margin-left:-.6rem;padding:0 .8rem 0 .2rem;border-radius:var(--r-sm);color:var(--coral);font-size:1.4rem;font-weight:500;max-width:14rem}
.bk span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stop{margin-left:auto;flex:none;height:3.2rem;padding:0 1.5rem;border-radius:1.6rem;font-size:1.25rem;font-weight:700;letter-spacing:.06em;color:#fff;
  background:#e5342a}
</style>

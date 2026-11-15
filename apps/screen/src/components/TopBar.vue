<script setup>
// Верхня смуга. На головній — знак Vyron і стан принтера; на інших сторінках — «‹ Назад» з назвою попередньої (як в iOS),
// а назва поточної — великим заголовком на самій сторінці.
// STOP завжди на місці в правому куті: аварійна зупинка доступна з будь-якої сторінки.
import { computed } from 'vue'
import { SHAPE, V } from '@vyron/shared/logo'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from './Icon.vue'
import StatusPill from './StatusPill.vue'

const emit = defineEmits(['stop'])
const p = usePrinter()

const sub = computed(() => p.page !== 'home')
const prev = computed(() => p.stack[p.stack.length - 2])
</script>

<template>
  <header class="tb">
    <template v-if="!sub">
      <svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><path class="sh" :d="SHAPE" /><path class="v" :d="V" /></svg>
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
.logo{width:2.6rem;height:2.6rem;flex:none}
.sh{fill:var(--brand)}
.v{fill:none;stroke:#fff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
/* «‹ Назад» — акцентним кольором теми, як системна кнопка iOS */
.bk{flex:none;display:flex;align-items:center;gap:.1rem;height:3.6rem;margin-left:-.6rem;padding:0 .8rem 0 .2rem;border-radius:var(--r-sm);color:var(--coral);font-size:1.4rem;font-weight:500;max-width:14rem}
.bk span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stop{margin-left:auto;flex:none;height:3.2rem;padding:0 1.5rem;border-radius:1.6rem;font-size:1.3rem;font-weight:800;letter-spacing:.08em;color:#fff;
  background:linear-gradient(180deg,#ff5b4f,#e0261a);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
</style>

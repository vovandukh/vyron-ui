<script setup>
// Верхня смуга. На головній — знак Vyron і стан принтера; на інших сторінках — «‹ Назад» з назвою попередньої (як в iOS),
// а назва поточної — великим заголовком на самій сторінці.
// STOP завжди на місці в правому куті: аварійна зупинка доступна з будь-якої сторінки.
import { computed } from 'vue'
import { SHAPE, V } from '@vyron/shared/logo'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from './Icon.vue'

const emit = defineEmits(['stop'])
const p = usePrinter()

const status = computed(() => {
  if (p.link !== 'open') return { text: t('scr.connecting'), tone: 'dim' }
  const k = p.klippy.state
  if (k === 'shutdown' || k === 'error') return { text: t('state.klipperError'), tone: 'red' }
  if (k === 'startup') return { text: t('state.klipperStartup'), tone: 'amber' }
  if (k !== 'ready') return { text: t('state.klipperOffline'), tone: 'amber' }
  const s = p.printState
  if (s === 'printing') return { text: t('state.printing'), tone: 'brand' }
  if (s === 'paused') return { text: t('state.paused'), tone: 'amber' }
  if (s === 'complete') return { text: t('state.complete'), tone: 'green' }
  if (s === 'error') return { text: t('state.error'), tone: 'red' }
  return { text: t('state.ready'), tone: 'green' }
})
const sub = computed(() => p.page !== 'home')
const prev = computed(() => p.stack[p.stack.length - 2])
</script>

<template>
  <header class="tb">
    <template v-if="!sub">
      <svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><path class="sh" :d="SHAPE" /><path class="v" :d="V" /></svg>
      <span class="st" :class="'t-' + status.tone"><i></i>{{ status.text }}</span>
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
.st{flex:1;min-width:0;display:flex;align-items:center;gap:.6rem;font-size:1.45rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st i{flex:none;width:.75rem;height:.75rem;border-radius:50%;background:currentColor}
.t-dim{color:var(--dim)}
.t-red{color:var(--red)}
.t-amber{color:var(--amber)}
.t-green{color:var(--green)}
.t-brand{color:var(--ink)}
.t-brand i{background:var(--coral)}
/* «‹ Назад» — акцентним кольором теми, як системна кнопка iOS */
.bk{flex:none;display:flex;align-items:center;gap:.1rem;height:3.6rem;margin-left:-.6rem;padding:0 .8rem 0 .2rem;border-radius:var(--r-sm);color:var(--coral);font-size:1.4rem;font-weight:500;max-width:14rem}
.bk span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stop{margin-left:auto;flex:none;height:3.2rem;padding:0 1.5rem;border-radius:1.6rem;font-size:1.3rem;font-weight:800;letter-spacing:.08em;color:#fff;
  background:linear-gradient(180deg,#ff5b4f,#e0261a);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
</style>

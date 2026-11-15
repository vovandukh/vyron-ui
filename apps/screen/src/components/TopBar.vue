<script setup>
// Верхня смуга: знак Vyron, стан принтера, кнопка STOP (завжди на місці, найбільша ціль у правому куті).
import { computed } from 'vue'
import { SHAPE, V } from '@vyron/shared/logo'
import { usePrinter } from '../store'
import { t } from '../i18n'

const emit = defineEmits(['stop'])
const p = usePrinter()

const status = computed(() => {
  if (p.link !== 'open') return { text: t('scr.connecting'), tone: 'dim' }
  const k = p.klippy.state
  if (k === 'shutdown' || k === 'error') return { text: t('state.klipperError'), tone: 'red' }
  if (k === 'startup') return { text: t('state.klipperStartup'), tone: 'amber' }
  if (k !== 'ready') return { text: t('state.klipperOffline'), tone: 'amber' }
  const s = p.printState
  if (s === 'printing') return { text: t('state.printing') + ' · ' + Math.floor(p.progress * 100) + '%', tone: 'brand' }
  if (s === 'paused') return { text: t('state.paused'), tone: 'amber' }
  if (s === 'complete') return { text: t('state.complete'), tone: 'green' }
  if (s === 'error') return { text: t('state.error'), tone: 'red' }
  return { text: t('state.ready'), tone: 'green' }
})
</script>

<template>
  <header class="tb">
    <svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><path class="sh" :d="SHAPE" /><path class="v" :d="V" /></svg>
    <span class="st" :class="'t-' + status.tone"><i></i>{{ status.text }}</span>
    <button type="button" class="stop tap" :aria-label="t('estop.label')" @click="emit('stop')">STOP</button>
  </header>
</template>

<style scoped>
.tb{height:4.6rem;display:flex;align-items:center;gap:1rem;padding:0 1rem 0 1.2rem;border-bottom:1px solid var(--line)}
.logo{width:2.4rem;height:2.4rem;flex:none}
.sh{fill:var(--brand)}
.v{fill:none;stroke:#fff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.st{flex:1;min-width:0;display:flex;align-items:center;gap:.7rem;font-size:1.5rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st i{flex:none;width:.8rem;height:.8rem;border-radius:50%;background:currentColor}
.t-dim{color:var(--dim)}
.t-red{color:var(--red)}
.t-amber{color:var(--amber)}
.t-green{color:var(--green)}
.t-brand{color:var(--ink)}
.t-brand i{background:var(--coral)}
.stop{flex:none;height:3.4rem;padding:0 1.6rem;border-radius:1.7rem;background:var(--red);color:#fff;font-size:1.4rem;font-weight:800;letter-spacing:.08em}
</style>

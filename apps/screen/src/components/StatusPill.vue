<script setup>
// «Пігулка» стану, як у Vyron Web: чорна капсула з крапкою, станом і часом до кінця.
// Подія (друк почався / завершився, Klipper готовий / зупинився…) на 3 с займає капсулу своїм кольором.
// Анімація дешева: лише ширина (max-width) і opacity тексту — без розмиття й тіней.
import { computed } from 'vue'
import { fmtDuration } from '@vyron/shared/format'
import { usePrinter } from '../store'
import { t } from '../i18n'

const p = usePrinter()

const base = computed(() => {
  if (p.link !== 'open') return { text: t('scr.connecting'), tone: 'dim' }
  const k = p.klippy.state
  if (k === 'shutdown' || k === 'error') return { text: t('state.klipperError'), tone: 'red' }
  if (k === 'startup') return { text: t('state.klipperStartup'), tone: 'amber' }
  if (k !== 'ready') return { text: t('state.klipperOffline'), tone: 'amber' }
  const s = p.printState
  if (s === 'printing') return { text: t('state.printing'), tone: 'brand', eta: p.remaining == null ? '' : fmtDuration(p.remaining, t) }
  if (s === 'paused') return { text: t('state.paused'), tone: 'amber' }
  if (s === 'complete') return { text: t('state.complete'), tone: 'green' }
  if (s === 'error') return { text: t('state.error'), tone: 'red' }
  return { text: t('state.ready'), tone: 'green' }
})
const view = computed(() => (p.event ? { text: t(p.event.key, p.event.params), tone: p.event.tone, ev: true } : base.value))
</script>

<template>
  <div class="pill" :class="['t-' + view.tone, { ev: view.ev }]" role="status" aria-live="polite">
    <i class="dot"></i>
    <span :key="view.text" class="tx">{{ view.text }}</span>
    <span v-if="view.eta" class="eta">{{ view.eta }}</span>
  </div>
</template>

<style scoped>
.pill{display:flex;align-items:center;gap:.6rem;height:3.4rem;max-width:24rem;padding:0 1.2rem 0 1rem;border-radius:1.6rem;
  background:#000;border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  font-size:1.3rem;font-weight:600;white-space:nowrap;overflow:hidden;transition:max-width .3s var(--ease),border-color .3s var(--ease)}
.dot{flex:none;width:.75rem;height:.75rem;border-radius:50%;background:var(--tone)}
.tx{min-width:0;overflow:hidden;text-overflow:ellipsis;animation:in .25s var(--ease)}
.eta{flex:none;color:var(--dim);font-weight:500}
.eta::before{content:'·';margin-right:.5rem}
@keyframes in{from{opacity:0;transform:translateY(.4rem)}}
.t-dim{--tone:var(--dim);color:var(--dim)}
.t-red{--tone:var(--red)}
.t-amber{--tone:var(--amber)}
.t-green{--tone:var(--green)}
.t-brand{--tone:var(--coral)}
/* Подія: капсула підсвічується кольором події */
.ev{border-color:color-mix(in srgb,var(--tone) 55%,transparent);color:var(--tone)}
@supports not (border-color:color-mix(in srgb,red 50%,blue)){.ev{border-color:var(--tone)}}
.ev.t-brand{color:var(--ink)}
</style>

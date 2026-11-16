<script setup>
// Тонке налаштування під час друку (@vyron/shared/klipper/tune — та сама логіка, що у Vyron Web):
// Z-зсув (babystep) з кроками 0.01 / 0.05 мм, швидкість, потік, обдув. Усе на одному екрані, без прокрутки.
import { computed } from 'vue'
import { tuneValues, fmtZ, TUNE_STEPS } from '@vyron/shared/klipper/tune'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from './Icon.vue'

const emit = defineEmits(['close'])
const p = usePrinter()
const v = computed(() => tuneValues(p.st))
const Z = [-TUNE_STEPS.z[1], -TUNE_STEPS.z[0], TUNE_STEPS.z[0], TUNE_STEPS.z[1]]
const ROWS = [
  { k: 'speed', step: TUNE_STEPS.speed },
  { k: 'flow', step: TUNE_STEPS.flow },
  { k: 'fan', step: TUNE_STEPS.fan }
]
const sign = d => (d > 0 ? '+' : '−') + Math.abs(d)
const pct = (k, d) => p.tune(k, (v.value[k] || 0) + d)
</script>

<template>
  <div class="sheet">
    <header class="hd">
      <span class="ttl">{{ t('tune.title') }}</span>
      <button type="button" class="done tap" @click="emit('close')">{{ t('common.done') }}</button>
    </header>

    <div class="zhead">
      <span class="lbl">{{ t('tune.z') }}</span>
      <b class="zval" :class="{ off: v.z !== 0 }">{{ fmtZ(v.z) }}<small> {{ t('tune.mm') }}</small></b>
      <button type="button" class="reset tap" :disabled="v.z === 0" @click="p.tune('zreset')">{{ t('tune.reset') }}</button>
    </div>
    <div class="zrow">
      <button v-for="d in Z" :key="d" type="button" class="zb tap" @click="p.tune('z', d)">{{ sign(d) }}</button>
    </div>

    <div v-for="r in ROWS" :key="r.k" class="row" :class="{ na: v[r.k] == null }">
      <span class="lbl">{{ t('tune.' + r.k) }}</span>
      <button type="button" class="pm tap" :disabled="v[r.k] == null" :aria-label="t('tune.' + r.k) + ' −'" @click="pct(r.k, -r.step)">
        <Icon name="minus" size="1.8rem" :stroke="2.4" />
      </button>
      <span class="num">{{ v[r.k] == null ? '–' : v[r.k] }}<small v-if="v[r.k] != null">%</small></span>
      <button type="button" class="pm tap" :disabled="v[r.k] == null" :aria-label="t('tune.' + r.k) + ' +'" @click="pct(r.k, r.step)">
        <Icon name="plus" size="1.8rem" :stroke="2.4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Поверх головної, під верхньою смугою: суцільний фон (без розмиття — SPI-екран) */
.sheet{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;gap:.6rem;padding:.2rem 1.2rem 1.2rem;background:var(--bg)}
.hd{display:flex;align-items:center;justify-content:space-between;height:3rem}
.ttl{font-size:1.15rem;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:.06em}
.done{height:3rem;padding:0 1.4rem;border-radius:1.5rem;background:var(--primary);color:var(--on-primary);font-size:1.3rem;font-weight:600}
.lbl{font-size:1.25rem;color:var(--dim)}
.zhead{display:flex;align-items:baseline;gap:1rem}
.zval{font-size:2rem;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.zval.off{color:var(--coral)}
.zval small{font-size:1.1rem;font-weight:500;color:var(--dim)}
.reset{margin-left:auto;align-self:center;height:2.6rem;padding:0 1rem;border-radius:var(--r-sm);color:var(--coral);font-size:1.15rem;font-weight:600}
.zrow{display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem}
.zb{height:4.4rem;border-radius:var(--r);background:var(--btn);border:1px solid var(--btn-edge);font-size:1.45rem;font-weight:600;font-variant-numeric:tabular-nums}
.row{display:flex;align-items:center;gap:.8rem;height:4.2rem}
.row .lbl{flex:1}
.row.na{opacity:.45}
.pm{width:5.6rem;height:4.2rem;border-radius:var(--r);background:var(--btn);border:1px solid var(--btn-edge);display:grid;place-items:center;color:var(--tile-ink)}
.num{width:6.6rem;text-align:center;font-size:2rem;font-weight:600;font-variant-numeric:tabular-nums}
.num small{font-size:1.2rem;font-weight:500;color:var(--dim);margin-left:.1rem}
</style>

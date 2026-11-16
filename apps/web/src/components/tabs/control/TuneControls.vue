<script setup>
// Під час друку на місці «Руху»: тонке налаштування — Z-зсув (babystep), швидкість, потік, обдув.
// Та сама логіка, що на екрані принтера (@vyron/shared/klipper/tune).
import { computed } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useI18n } from '../../../composables/useI18n'
import { tuneValues, fmtZ, TUNE_STEPS } from '@vyron/shared/klipper/tune'

defineProps({ inline: { type: Boolean, default: false } })
const printer = usePrinterStore()
const { t, tm } = useI18n()
const v = computed(() => tuneValues(printer.st))

const ROWS = [
  { k: 'speed', step: TUNE_STEPS.speed },
  { k: 'flow', step: TUNE_STEPS.flow },
  { k: 'fan', step: TUNE_STEPS.fan }
]
const z = d => printer.tune('z', d)
const pct = (k, d) => printer.tune(k, (v.value[k] || 0) + d)
</script>

<template>
  <div class="ctl glass" :class="{ inline }">
    <div v-if="!inline" class="hd"><span class="ttl">{{ t('tune.title') }}</span></div>

    <!-- Z-зсув: два кроки в кожен бік, значення посередині; клік по значенню — скинути -->
    <div class="zrow">
      <span class="lbl">{{ t('tune.z') }}</span>
      <div class="seg z">
        <button :aria-label="'Z −' + TUNE_STEPS.z[1]" @click="z(-TUNE_STEPS.z[1])">−{{ TUNE_STEPS.z[1] }}</button>
        <button :aria-label="'Z −' + TUNE_STEPS.z[0]" @click="z(-TUNE_STEPS.z[0])">−{{ TUNE_STEPS.z[0] }}</button>
        <button class="val" :class="{ off: v.z !== 0 }" :title="t('tune.reset')" :disabled="v.z === 0" @click="printer.tune('zreset')">{{ fmtZ(v.z) }}</button>
        <button :aria-label="'Z +' + TUNE_STEPS.z[0]" @click="z(TUNE_STEPS.z[0])">+{{ TUNE_STEPS.z[0] }}</button>
        <button :aria-label="'Z +' + TUNE_STEPS.z[1]" @click="z(TUNE_STEPS.z[1])">+{{ TUNE_STEPS.z[1] }}</button>
      </div>
    </div>

    <div v-for="r in ROWS" :key="r.k" class="row" :class="{ na: v[r.k] == null }">
      <span class="lbl">{{ t('tune.' + r.k) }}</span>
      <div class="seg">
        <button :disabled="v[r.k] == null" :aria-label="t('tune.' + r.k) + ' −'" @click="pct(r.k, -r.step)">−</button>
        <span class="num">{{ v[r.k] == null ? '–' : v[r.k] + '%' }}</span>
        <button :disabled="v[r.k] == null" :aria-label="t('tune.' + r.k) + ' +'" @click="pct(r.k, r.step)">+</button>
      </div>
    </div>
    <div class="hint">{{ t('tune.hint') }}</div>
    <div v-if="printer.ctlMsg" class="cmsg">{{ tm(printer.ctlMsg) }}</div>
  </div>
</template>

<style scoped>
.ctl{position:fixed;left:32px;top:50%;transform:translateY(-50%);display:grid;gap:8px;padding:12px;border-radius:var(--r-lg);font-size:12px;z-index:3;width:280px}
.hd{padding:0 2px 2px}
.ttl{font-size:11px;font-weight:500;color:var(--dim);letter-spacing:.06em;text-transform:uppercase}
.ctl button{border:0;background:rgba(255,255,255,.05);color:var(--ink);font:inherit;cursor:pointer;
  transition:transform var(--t-spring) var(--spring),color var(--t-fast) var(--ease-out),background-color var(--t-fast) var(--ease-out)}
.ctl button:hover:not(:disabled){color:var(--coral);background-color:rgba(255,255,255,.11)}
.ctl button:active:not(:disabled){transform:scale(.95);background-color:rgba(var(--accent-rgb),.16)}
.ctl button:focus-visible{outline:2px solid var(--coral);outline-offset:-2px}
.ctl button:disabled{opacity:.35;cursor:default}
.lbl{color:var(--dim);font-size:11.5px}
.zrow{display:grid;gap:6px}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.row.na{opacity:.5}
/* Сегмент — одна поверхня з тонкими розділювачами, як у «Русі» */
.seg{display:flex;border-radius:var(--r);overflow:hidden;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.25)}
.seg > * + *{border-left:1px solid rgba(255,255,255,.07)!important}
.seg button{height:34px;min-width:38px;font-size:16px}
.seg.z button{flex:1;min-width:0;font-size:11.5px;font-weight:500;color:var(--dim)}
.seg.z .val{flex:1.4;font-size:13px;font-weight:600;color:var(--ink);background:rgba(0,0,0,.15)}
.seg.z .val.off{color:var(--coral)}
.seg.z .val:disabled{opacity:1;cursor:default}
.num{min-width:60px;display:grid;place-items:center;font-size:13px;font-weight:500}
.hint{color:var(--dim2,#636366);font-size:10.5px;line-height:1.4;padding:0 2px}
.cmsg{color:var(--coral);font-size:11px;padding:0 2px}
@media(max-width:900px){.ctl{left:14px}}
/* У мобільному стовпчику: звичайний блок на всю ширину, кнопки більші під палець */
.ctl.inline{position:static;transform:none;width:auto;padding:14px;border-radius:var(--r-xl);font-size:13px}
.inline .seg button{height:40px;min-width:46px}
.inline .num{min-width:70px}
</style>

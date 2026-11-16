<script setup>
// Тонке налаштування під час друку — повноцінна сторінка в стилі «Нагріву»: Z-зсув (babystep) кроками
// 0.01 / 0.05 мм, швидкість, потік, обдув. Логіка спільна з Vyron Web (@vyron/shared/klipper/tune).
import { computed } from 'vue'
import { tuneValues, fmtZ, TUNE_STEPS } from '@vyron/shared/klipper/tune'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from '../components/Icon.vue'

const p = usePrinter()
const v = computed(() => tuneValues(p.st))
const Z = [-TUNE_STEPS.z[1], -TUNE_STEPS.z[0], TUNE_STEPS.z[0], TUNE_STEPS.z[1]]
const ROWS = [
  { k: 'speed', icon: 'speed', step: TUNE_STEPS.speed },
  { k: 'flow', icon: 'flow', step: TUNE_STEPS.flow },
  { k: 'fan', icon: 'fan', step: TUNE_STEPS.fan }
]
const sign = d => (d > 0 ? '+' : '−') + Math.abs(d)
const pct = (k, d) => p.tune(k, (v.value[k] || 0) + d)
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.tune') }}</h1>

    <!-- Z-зсув: значення, скидання й чотири кроки -->
    <div class="grp zg">
      <div class="zh">
        <span class="ti" :class="{ on: v.z !== 0 }"><Icon name="zoff" size="1.8rem" /></span>
        <span class="nm">
          <span class="lbl">{{ t('tune.z') }}</span>
          <b class="now" :class="{ on: v.z !== 0 }">{{ fmtZ(v.z) }}<i>{{ t('tune.mm') }}</i></b>
        </span>
        <button type="button" class="rs tap" :disabled="v.z === 0" @click="p.tune('zreset')">{{ t('scr.tune.reset') }}</button>
      </div>
      <div class="zrow">
        <button v-for="d in Z" :key="d" type="button" class="zb tap" @click="p.tune('z', d)">{{ sign(d) }}</button>
      </div>
    </div>
    <p class="grp-f">{{ t('tune.hint') }}</p>

    <!-- Швидкість, потік, обдув — рядки як у «Нагріві»: іконка, назва зі значенням, −/+ -->
    <div class="grp">
      <div v-for="r in ROWS" :key="r.k" class="hr" :class="{ na: v[r.k] == null }">
        <span class="ti"><Icon :name="r.icon" size="1.8rem" /></span>
        <span class="nm">
          <span class="lbl">{{ t('tune.' + r.k) }}</span>
          <b class="now">{{ v[r.k] == null ? '–' : v[r.k] }}<i v-if="v[r.k] != null">%</i></b>
        </span>
        <span class="seg">
          <button type="button" class="pm tap" :disabled="v[r.k] == null" :aria-label="t('tune.' + r.k) + ' −'" @click="pct(r.k, -r.step)"><Icon name="minus" size="1.7rem" :stroke="2.4" /></button>
          <button type="button" class="pm tap" :disabled="v[r.k] == null" :aria-label="t('tune.' + r.k) + ' +'" @click="pct(r.k, r.step)"><Icon name="plus" size="1.7rem" :stroke="2.4" /></button>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.zg{padding:.6rem .8rem .9rem}
.zh{display:flex;align-items:center;gap:1rem;padding:0 0 .8rem .4rem}
.hr{display:flex;align-items:center;gap:1rem;min-height:5.8rem;padding:.6rem .8rem .6rem 1.2rem;box-shadow:inset 0 -1px 0 var(--group-sep)}
.hr:last-child{box-shadow:none}
.hr.na{opacity:.45}
.ti{flex:none;width:3.2rem;height:3.2rem;border-radius:.9rem;display:grid;place-items:center;background:var(--tile);color:var(--tile-ink)}
.ti.on{color:var(--coral)}
.nm{flex:1;min-width:0;display:grid}
.lbl{font-size:1.15rem;color:var(--dim)}
.now{font-size:2.2rem;font-weight:600;line-height:1.1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.now i{margin-left:.25rem;font-style:normal;font-weight:400;font-size:1.3rem;color:var(--dim)}
.now.on{color:var(--coral)}
.rs{flex:none;height:3.6rem;padding:0 1.2rem;border-radius:var(--r);background:var(--btn);border:1px solid var(--btn-edge);font-size:1.2rem;font-weight:600;color:var(--coral)}
.rs:disabled{color:var(--dim2)}
.zrow{display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem}
.zb{height:4.6rem;border-radius:var(--r);background:var(--btn);border:1px solid var(--btn-edge);font-size:1.5rem;font-weight:600;font-variant-numeric:tabular-nums}
.seg{flex:none;display:flex;align-items:center;gap:.5rem}
.pm{width:5rem;height:4.4rem;border-radius:var(--r);background:var(--btn);border:1px solid var(--btn-edge);display:grid;place-items:center;color:var(--tile-ink)}
.grp-f{margin-bottom:1.4rem}
</style>

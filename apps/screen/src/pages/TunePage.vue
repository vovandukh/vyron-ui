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
        <span class="ti" :class="{ on: v.z !== 0 }"><Icon name="zoff" size="1.6rem" /></span>
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
        <span class="ti"><Icon :name="r.icon" size="1.6rem" /></span>
        <span class="nm">
          <span class="lbl">{{ t('tune.' + r.k) }}</span>
          <b class="now">{{ v[r.k] == null ? '–' : v[r.k] }}<i v-if="v[r.k] != null">%</i></b>
        </span>
        <span class="seg">
          <button type="button" class="pm tap" :disabled="v[r.k] == null" :aria-label="t('tune.' + r.k) + ' −'" @click="pct(r.k, -r.step)"><Icon name="minus" size="1.5rem" :stroke="2.4" /></button>
          <button type="button" class="pm tap" :disabled="v[r.k] == null" :aria-label="t('tune.' + r.k) + ' +'" @click="pct(r.k, r.step)"><Icon name="plus" size="1.5rem" :stroke="2.4" /></button>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Групи — на легкому склі, як плитки головної (замість суцільного сірого фону) */
.grp{background:linear-gradient(180deg,rgba(255,255,255,calc(.075 * var(--glass-f))),rgba(255,255,255,calc(.035 * var(--glass-f)))),rgba(18,18,20,var(--glass-back));
  border:1px solid var(--card-edge);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
.zg{padding:.6rem .8rem .8rem}
.zh{display:flex;align-items:center;gap:.9rem;padding:0 0 .7rem .4rem}
.hr{display:flex;align-items:center;gap:.9rem;min-height:5rem;padding:.5rem .8rem .5rem 1.1rem;box-shadow:inset 0 -1px 0 var(--group-sep)}
.hr:last-child{box-shadow:none}
.hr.na{opacity:.45}
.ti{flex:none;width:2.8rem;height:2.8rem;border-radius:.8rem;display:grid;place-items:center;background:var(--tile);color:var(--tile-ink)}
.ti.on{color:var(--coral)}
.nm{flex:1;min-width:0;display:grid}
.lbl{font-size:1.1rem;color:var(--dim)}
.now{font-size:2rem;font-weight:600;line-height:1.1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.now i{margin-left:.25rem;font-style:normal;font-weight:400;font-size:1.2rem;color:var(--dim)}
.now.on{color:var(--coral)}
/* Кнопки компактні: менші за плитки, щоб не «кричали» */
.rs{flex:none;height:2.9rem;padding:0 1rem;border-radius:var(--r-sm);background:var(--btn);border:1px solid var(--btn-edge);font-size:1.1rem;font-weight:600;color:var(--coral)}
.rs:disabled{color:var(--dim2)}
.zrow{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem}
.zb{height:3.6rem;border-radius:var(--r-sm);background:var(--btn);border:1px solid var(--btn-edge);font-size:1.3rem;font-weight:600;font-variant-numeric:tabular-nums}
.seg{flex:none;display:flex;align-items:center;gap:.4rem}
.pm{width:4rem;height:3.4rem;border-radius:var(--r-sm);background:var(--btn);border:1px solid var(--btn-edge);display:grid;place-items:center;color:var(--tile-ink)}
.grp-f{margin-bottom:1.4rem}
</style>

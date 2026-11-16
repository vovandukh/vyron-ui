<script setup>
// Нагрів: пресети матеріалів (сопло + стіл разом), точна ціль кожного нагрівача кнопками ±5° і «Вимкнути нагрів».
// Термокамера без власного нагрівача — лише показ температури. Логіка й пресети спільні з Vyron Web (@vyron/shared/klipper/heat).
import { computed } from 'vue'
import { HEAT_PRESETS, HEAT_STEP, heaterKind, presetActive } from '@vyron/shared/klipper/heat'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from '../components/Icon.vue'

const p = usePrinter()
const temp = v => (v == null ? '–' : Math.round(v))
/** Тільки нагрівачі з ціллю (сопло, стіл); датчики без нагріву — окремо, лише для показу */
const heaters = computed(() => p.heaters.filter(h => h.target !== undefined))
const sensors = computed(() => p.heaters.filter(h => h.target === undefined))
const nozzle = computed(() => p.heaters.find(h => heaterKind(h.id) === 'nozzle') || {})
const bed = computed(() => p.heaters.find(h => h.id === 'heater_bed') || {})
const anyOn = computed(() => heaters.value.some(h => h.target > 0))

// Перше натискання «+» з вимкненого стану — одразу розумна стартова температура, а не 5°
const START = { nozzle: 180, bed: 50 }
function bump(h, d) {
  const cur = Math.round(h.target || 0)
  let next = cur + d
  if (cur === 0 && d > 0) next = START[heaterKind(h.id)] || 50
  if (next < 40 && d < 0) next = 0
  p.setTemp(h.id, next)
}
function preset(x) {
  if (nozzle.value.id) p.setTemp(nozzle.value.id, x.nozzle)
  if (bed.value.id) p.setTemp(bed.value.id, x.bed)
}
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.temp') }}</h1>

    <div class="pre">
      <button v-for="x in HEAT_PRESETS" :key="x.id" type="button" class="chip tap"
              :class="{ on: presetActive(x, nozzle.target, bed.target) }" @click="preset(x)">
        <b>{{ x.name }}</b><small>{{ x.nozzle }}° / {{ x.bed }}°</small>
      </button>
    </div>

    <div class="grp">
      <div v-for="h in heaters" :key="h.id" class="hr" :class="{ hot: h.target > 0 }">
        <span class="ti"><Icon :name="h.icon" size="1.8rem" /></span>
        <span class="nm">
          <span class="lbl">{{ t(h.key) }}</span>
          <b class="now">{{ temp(h.temperature) }}<i>°</i></b>
        </span>
        <span class="seg">
          <button type="button" class="pm tap" :aria-label="t(h.key) + ' −'" @click="bump(h, -HEAT_STEP)"><Icon name="minus" size="1.7rem" :stroke="2.4" /></button>
          <span class="tg">{{ h.target > 0 ? Math.round(h.target) + '°' : t('qs.off') }}</span>
          <button type="button" class="pm tap" :aria-label="t(h.key) + ' +'" @click="bump(h, HEAT_STEP)"><Icon name="plus" size="1.7rem" :stroke="2.4" /></button>
        </span>
      </div>
      <div v-for="h in sensors" :key="h.id" class="hr">
        <span class="ti"><Icon :name="h.icon" size="1.8rem" /></span>
        <span class="nm"><span class="lbl">{{ t(h.key) }}</span><b class="now">{{ temp(h.temperature) }}<i>°</i></b></span>
      </div>
    </div>

    <button type="button" class="off tap" :disabled="!anyOn" @click="p.heatOff()">
      <Icon name="power" size="1.7rem" :stroke="2.2" />{{ t('heat.off') }}
    </button>
    <p class="grp-f">{{ t('heat.hint') }}</p>
  </div>
</template>

<style scoped>
.pre{display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:1.2rem}
.chip{height:5rem;border-radius:var(--r);background:var(--btn);border:1px solid var(--btn-edge);display:grid;place-content:center;gap:.2rem}
.chip b{font-size:1.45rem;font-weight:700}
.chip small{font-size:1.05rem;color:var(--dim);font-variant-numeric:tabular-nums}
.chip.on{background:var(--primary);border-color:transparent;color:var(--on-primary)}
.chip.on small{color:inherit;opacity:.7}
.hr{display:flex;align-items:center;gap:1rem;min-height:6rem;padding:.6rem .8rem .6rem 1.2rem;box-shadow:inset 0 -1px 0 var(--group-sep)}
.hr:last-child{box-shadow:none}
.ti{flex:none;width:3.2rem;height:3.2rem;border-radius:.9rem;display:grid;place-items:center;background:var(--tile);color:var(--tile-ink)}
.hot .ti{color:var(--coral)}
.nm{flex:1;min-width:0;display:grid}
.lbl{font-size:1.15rem;color:var(--dim)}
.now{font-size:2.2rem;font-weight:600;line-height:1.1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.now i{font-style:normal;font-weight:400;color:var(--dim)}
.hot .now{color:var(--coral)}
.seg{flex:none;display:flex;align-items:center;gap:.4rem}
.pm{width:4.6rem;height:4.4rem;border-radius:var(--r);background:var(--btn);border:1px solid var(--btn-edge);display:grid;place-items:center;color:var(--tile-ink)}
.tg{width:6rem;text-align:center;font-size:1.7rem;font-weight:600;font-variant-numeric:tabular-nums}
.off{width:100%;height:4.6rem;margin-top:1.2rem;border-radius:var(--r);display:flex;align-items:center;justify-content:center;gap:.7rem;
  background:var(--btn);border:1px solid var(--btn-edge);font-size:1.4rem;font-weight:600;color:var(--red)}
</style>

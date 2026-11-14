<script setup>
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../composables/useI18n'
import GlassSelect from '../ui/GlassSelect.vue'
import StepperInput from '../ui/StepperInput.vue'

const settings = useSettingsStore()
const { t } = useI18n()

const LANGS = [
  { value: 'uk', label: 'Українська', hint: 'UK' },
  { value: 'en', label: 'English', hint: 'EN' }
]
const checks = ['cEstop', 'cSys', 'invX', 'invY', 'invZ']
/** Швидкості руху: крок «−/+» і межі (мм/хв) */
const numbers = [
  { k: 'fxy', step: 100, min: 100, max: 30000 },
  { k: 'fz', step: 50, min: 10, max: 6000 }
]
</script>

<template>
  <section class="view">
    <div class="sf">
      <!-- Рядки з власними контролами — div, а не label: клік по тексту label «натиснув» би першу кнопку всередині -->
      <div class="srow">
        <span id="set-lang">{{ t('set.lang') }}</span>
        <GlassSelect :model-value="settings.lang" :options="LANGS" :aria-label="t('set.lang')" @update:model-value="settings.set('lang', $event)" />
      </div>
      <label v-for="k in checks" :key="k" class="srow">
        <span>{{ t('set.' + k) }}</span>
        <input type="checkbox" :checked="settings[k]" @change="settings.set(k, $event.target.checked)">
      </label>
      <div v-for="n in numbers" :key="n.k" class="srow">
        <span>{{ t('set.' + n.k) }}</span>
        <StepperInput :model-value="settings[n.k]" :step="n.step" :min="n.min" :max="n.max" :aria-label="t('set.' + n.k)"
                      @update:model-value="settings.set(n.k, $event)" />
      </div>
      <div class="note">{{ t('set.note') }}</div>
    </div>
  </section>
</template>

<style scoped>
.sf{display:grid;max-width:540px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--r-lg);overflow:hidden}
.srow{display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:13px;padding:10px 14px;min-height:54px}
.srow+.srow{border-top:1px solid var(--hair)}
label.srow{cursor:pointer}
.srow>span{line-height:1.35}
.note{color:var(--dim);font-size:12px;padding:12px 14px;border-top:1px solid var(--hair)}
@media(max-width:560px){.srow{flex-wrap:wrap}}
</style>

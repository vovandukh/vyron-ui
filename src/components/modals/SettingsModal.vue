<script setup>
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../composables/useI18n'

const settings = useSettingsStore()
const { t } = useI18n()

const checks = ['cEstop', 'cSys', 'invX', 'invY', 'invZ']
const numbers = ['fxy', 'fz']

/** Невалідне число (≤ 0) повертає поле до збереженого значення. */
function setNumber(k, e) {
  if (!settings.set(k, e.target.value)) e.target.value = settings[k]
}
</script>

<template>
  <section class="view">
    <div class="sf">
      <label>{{ t('set.lang') }}
        <select :value="settings.lang" @change="settings.set('lang', $event.target.value)">
          <option value="uk">Українська</option>
          <option value="en">English</option>
        </select>
      </label>
      <label v-for="k in checks" :key="k">{{ t('set.' + k) }}
        <input type="checkbox" :checked="settings[k]" @change="settings.set(k, $event.target.checked)">
      </label>
      <label v-for="k in numbers" :key="k">{{ t('set.' + k) }}
        <input type="number" min="1" step="any" :value="settings[k]" @change="setNumber(k, $event)">
      </label>
      <div class="note">{{ t('set.note') }}</div>
    </div>
  </section>
</template>

<style scoped>
.sf{display:grid;max-width:520px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--r-lg);overflow:hidden}
.sf label{display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:13px;padding:11px 14px;min-height:50px}
.sf label+label{border-top:1px solid var(--hair)}
.sf input[type=number],.sf select{width:140px}
.sf input[type=number]{text-align:right}

.note{color:var(--dim);font-size:12px;padding:12px 14px;border-top:1px solid var(--hair)}
</style>

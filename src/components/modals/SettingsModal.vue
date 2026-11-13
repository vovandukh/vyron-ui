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
.sf{display:grid;gap:14px;max-width:480px}
.sf label{display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:13px}
.sf input[type=number],.sf select{background:none;border:1px solid var(--line);color:var(--ink);font:inherit;border-radius:7px;padding:8px 10px;width:130px}
.sf input[type=checkbox]{width:18px;height:18px;accent-color:var(--red)}
.sf option{background:#0a0a0b}
.note{color:var(--dim);font-size:12px}
</style>

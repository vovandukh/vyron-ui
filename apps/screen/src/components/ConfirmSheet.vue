<script setup>
// Підтвердження небезпечної дії на весь екран: великі кнопки, «Ні» — ліворуч і нейтральна,
// щоб випадковий дотик не виконав дію.
import { t } from '../i18n'

defineProps({ text: { type: String, required: true }, ok: { type: String, required: true }, cancel: { type: String, default: '' } })
const emit = defineEmits(['ok', 'cancel'])
</script>

<template>
  <div class="sheet" role="alertdialog" :aria-label="text">
    <p>{{ text }}</p>
    <div class="acts">
      <button type="button" class="btn tap" @click="emit('cancel')">{{ cancel || t('print.keep') }}</button>
      <button type="button" class="btn danger tap" @click="emit('ok')">{{ ok }}</button>
    </div>
  </div>
</template>

<style scoped>
.sheet{position:fixed;inset:0;z-index:10;display:flex;flex-direction:column;justify-content:center;gap:2rem;padding:2rem;background:rgba(8,8,10,.94)}
p{margin:0;font-size:1.9rem;font-weight:600;line-height:1.35;text-align:center}
.acts{display:flex;gap:1rem}
.btn{flex:1;height:5.6rem;border-radius:var(--r);background:var(--panel-hi);border:1px solid var(--line);font-size:1.6rem;font-weight:600}
.btn.danger{background:var(--red);border-color:transparent;color:#fff}
</style>

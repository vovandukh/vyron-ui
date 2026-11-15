<script setup>
// Підтвердження небезпечної дії — алерт у стилі iOS: картка по центру, дві великі кнопки.
// «Ні» ліворуч і нейтральна, щоб випадковий дотик не виконав дію.
import { t } from '../i18n'

defineProps({ text: { type: String, required: true }, ok: { type: String, required: true }, cancel: { type: String, default: '' } })
const emit = defineEmits(['ok', 'cancel'])
</script>

<template>
  <div class="dim" role="alertdialog" :aria-label="text" @click.self="emit('cancel')">
    <div class="card">
      <p>{{ text }}</p>
      <div class="acts">
        <button type="button" class="btn tap" @click="emit('cancel')">{{ cancel || t('print.keep') }}</button>
        <button type="button" class="btn danger tap" @click="emit('ok')">{{ ok }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dim{position:fixed;inset:0;z-index:10;display:grid;place-items:center;padding:1.6rem;background:rgba(0,0,0,.72)}
.card{width:min(38rem,100%);border-radius:var(--r-lg);overflow:hidden;background:#232326;border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
p{margin:0;padding:2rem 2rem 1.8rem;font-size:1.5rem;font-weight:600;line-height:1.4;text-align:center}
.acts{display:flex;border-top:1px solid var(--group-sep)}
.btn{flex:1;height:4.8rem;font-size:1.5rem;font-weight:500;color:var(--ink)}
.btn + .btn{border-left:1px solid var(--group-sep)}
.btn.danger{color:var(--red);font-weight:600}
</style>

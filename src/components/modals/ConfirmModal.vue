<script setup>
// Заміна нативних confirm()/prompt(): відкривається через uiStore.openDialog / useConfirm.
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useUiStore } from '../../stores/uiStore'
import { useI18n } from '../../composables/useI18n'

const ui = useUiStore()
const { t, tm } = useI18n()

const value = ref('')
const inp = ref(null), okBtn = ref(null)

watch(() => ui.dialog, d => {
  if (!d) return
  value.value = ''
  nextTick(() => (d.input ? inp.value : okBtn.value)?.focus())
})

const ok = () => ui.closeDialog(ui.dialog.input ? value.value : true)
const cancel = () => ui.closeDialog(ui.dialog.input ? null : false)

const onKey = e => { if (e.key === 'Escape' && ui.dialog) { e.stopPropagation(); cancel() } }
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="ui.dialog" class="dlg" @click.self="cancel">
    <div class="box" role="alertdialog" aria-modal="true" aria-labelledby="dlg-msg">
      <div id="dlg-msg" class="msg">{{ tm(ui.dialog.message) }}</div>
      <input v-if="ui.dialog.input" ref="inp" v-model="value" autocomplete="off" spellcheck="false" @keydown.enter="ok">
      <div class="acts">
        <button @click="cancel">{{ t('common.cancel') }}</button>
        <button ref="okBtn" class="primary" @click="ok">{{ t('common.ok') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dlg{position:fixed;inset:0;z-index:13;background:rgba(0,0,0,.6);display:grid;place-items:center}
.box{width:min(380px,92vw);background:rgba(14,15,17,.98);border:1px solid var(--line);border-radius:10px;padding:18px;display:grid;gap:14px}
.msg{font-size:14px;line-height:1.5}
input{background:none;border:1px solid var(--line);color:var(--ink);font:inherit;font-size:14px;border-radius:8px;padding:10px 12px}
.acts{display:grid;grid-template-columns:1fr 1.2fr;gap:8px}
button{background:none;border:1px solid var(--line);color:var(--ink);font:inherit;font-size:13px;border-radius:8px;padding:12px 10px;min-height:44px;cursor:pointer}
button:hover{border-color:var(--red)}
.primary{background:#d42a20;border-color:#d42a20;color:#fff;font-weight:600}
.box :focus-visible{outline:2px solid var(--red);outline-offset:2px}
</style>

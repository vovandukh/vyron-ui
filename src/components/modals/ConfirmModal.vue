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
  <Transition name="modal">
    <div v-if="ui.dialog" class="modal-back" @click.self="cancel">
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="dlg-msg">
        <div id="dlg-msg" class="msg">{{ tm(ui.dialog.message) }}</div>
        <input v-if="ui.dialog.input" ref="inp" v-model="value" autocomplete="off" spellcheck="false" @keydown.enter="ok">
        <div class="acts">
          <button @click="cancel">{{ t(ui.dialog.cancelKey || 'common.cancel') }}</button>
          <button ref="okBtn" class="primary" @click="ok">{{ t(ui.dialog.okKey || 'common.ok') }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.msg{font-size:14px;line-height:1.5}
input{font-size:14px;padding:11px 12px}
.acts{display:grid;grid-template-columns:1fr 1.2fr;gap:8px}
</style>

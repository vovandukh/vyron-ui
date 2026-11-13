<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useUiStore } from '../../stores/uiStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'

const printer = usePrinterStore()
const ui = useUiStore()
const { ask } = useConfirm()
const { t } = useI18n()

const open = ref(false)
const close = () => { open.value = false }
const onKey = e => { if (e.key === 'Escape') close() }
onMounted(() => { document.addEventListener('click', close); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('click', close); document.removeEventListener('keydown', onKey) })

function nav(v) { close(); ui.go(v) }

const SYS = {
  mr: { label: 'menu.restartMoonraker', confirm: 'confirm.restartMoonraker', method: 'machine.services.restart', params: { service: 'moonraker' } },
  reboot: { label: 'menu.reboot', confirm: 'confirm.reboot', method: 'machine.reboot' },
  off: { label: 'menu.shutdown', confirm: 'confirm.shutdown', method: 'machine.shutdown' }
}
async function sys(k) {
  close()
  const a = SYS[k]
  if (await ask(a.confirm)) printer.call(a.method, a.params || {}).catch(() => {})
}
</script>

<template>
  <div class="mnu">
    <button class="mbtn" aria-haspopup="menu" :aria-expanded="String(open)" :aria-label="t('menu.label')" @click.stop="open = !open">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="19" cy="12" r="1.7" fill="currentColor" /></svg>
    </button>
    <div v-if="open" class="mlist" role="menu" @click.stop>
      <button role="menuitem" @click="nav('set')">{{ t('menu.settings') }}</button>
      <button role="menuitem" @click="nav('upd')">{{ t('menu.updates') }}</button>
      <button role="menuitem" @click="nav('net')">{{ t('menu.net') }}</button>
      <hr>
      <button v-for="(a, k) in SYS" :key="k" role="menuitem" :disabled="printer.isPrinting" @click="sys(k)">{{ t(a.label) }}</button>
    </div>
  </div>
</template>

<style scoped>
.mnu{position:relative;pointer-events:auto}
.mbtn{background:rgba(10,10,11,.55);border:1px solid var(--line);color:var(--ink);width:34px;height:34px;border-radius:7px;cursor:pointer;display:grid;place-items:center}
.mbtn:hover{color:var(--red)}
.mlist{position:absolute;right:0;top:100%;margin-top:8px;min-width:240px;background:rgba(10,10,11,.97);border:1px solid var(--line);border-radius:8px;padding:6px;display:grid;gap:2px}
.mlist button{background:none;border:0;color:var(--ink);font:inherit;font-size:13px;text-align:left;padding:10px 12px;border-radius:6px;cursor:pointer}
.mlist button:hover:not(:disabled){background:rgba(255,255,255,.06)}
.mlist button:disabled{opacity:.35;cursor:not-allowed}
.mlist hr{border:0;border-top:1px solid var(--line);margin:4px 0;width:100%}
.mbtn:focus-visible,.mlist button:focus-visible{outline:2px solid var(--red);outline-offset:2px}
</style>

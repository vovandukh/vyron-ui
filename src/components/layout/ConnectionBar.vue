<script setup>
import { ref, watch } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useI18n } from '../../composables/useI18n'
import { normalizeHost } from '../../services/moonrakerClient'

const printer = usePrinterStore()
const { t } = useI18n()

const host = ref(printer.host || '')
watch(() => printer.host, h => { if (h) host.value = h })

function go() {
  const h = normalizeHost(host.value)
  if (!h) return
  host.value = h
  printer.connect(h, { remember: true })
}
</script>

<template>
  <div class="conn">
    <input v-model="host" :placeholder="t('conn.placeholder')" :aria-label="t('conn.aria')" @keydown.enter="go">
    <button :disabled="printer.link === 'connecting'" @click="go">{{ t('conn.connect') }}</button>
    <button @click="printer.startDemo()">{{ t('conn.demo') }}</button>
  </div>
</template>

<style scoped>
.conn{position:fixed;right:32px;bottom:18px;display:flex;gap:7px;z-index:4}
.conn input,.conn button{background:rgba(10,10,11,.75);border:1px solid var(--line);color:var(--ink);padding:9px 11px;border-radius:7px;font:inherit;font-size:12px}
.conn input{width:170px}
.conn button{cursor:pointer}
.conn button:hover{border-color:var(--red)}
.conn button:disabled{opacity:.5;cursor:wait}
@media(max-width:900px){.conn{right:12px;bottom:12px}.conn input{width:125px}}
@media(max-width:560px){.conn{left:10px;right:10px;justify-content:flex-end}.conn input{flex:1}}
</style>

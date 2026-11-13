<script setup>
import { computed, ref, shallowRef, nextTick, onActivated, onDeactivated } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'
import { demoUpdates } from '../../services/demo'

const printer = usePrinterStore()
const { ask } = useConfirm()
const { t, tm } = useI18n()

const vi = shallowRef({})
const busy = ref(false)
const msg = ref('')
const logLines = ref([])
const logEl = ref(null)
let lid = 0

function addLog(m, cls = '') {
  logLines.value.push({ id: ++lid, m, cls })
  nextTick(() => { if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight })
}

const rows = computed(() => Object.keys(vi.value).map(name => {
  const v = vi.value[name] || {}, sys = name === 'system', web = !sys && String(v.configured_type || '').startsWith('web')
  const behind = sys ? v.package_count || 0 : v.commits_behind ? v.commits_behind.length : 0
  const need = web ? !!v.remote_version && v.remote_version !== '?' && v.remote_version !== v.version : behind > 0
  const info = sys ? t('upd.packages', { n: v.package_count || 0 }) : (v.full_version_string || v.version || '–') + (web && need ? ' → ' + v.remote_version : '')
  const flag = v.is_dirty ? t('upd.dirty') : v.is_valid === false ? t('upd.invalid') : ''
  return { name, sys, need, info, status: flag || t(need ? 'upd.available' : 'upd.upToDate'), canUpdate: need && !flag }
}))

function load(refresh) {
  if (printer.demoMode) { vi.value = demoUpdates; return }
  msg.value = ''
  printer.call('machine.update.status', { refresh: !!refresh })
    .then(r => { vi.value = r.version_info || {}; busy.value = !!r.busy })
    .catch(e => { msg.value = e.message })
}

async function updateOne(r) {
  if (!(await ask({ key: 'upd.confirmOne', params: { name: r.name } }, true))) return
  addLog({ key: 'upd.updating', params: { name: r.name } })
  const m = r.sys ? 'machine.update.system' : r.name === 'klipper' ? 'machine.update.klipper' : r.name === 'moonraker' ? 'machine.update.moonraker' : 'machine.update.client'
  printer.call(m, m === 'machine.update.client' ? { name: r.name } : {}).catch(e => addLog({ raw: e.message }, 'e'))
}

async function updateAll() {
  if (!(await ask('upd.confirmAll', true))) return
  addLog({ key: 'upd.updatingAll' })
  printer.call('machine.update.full', {}).catch(e => addLog({ raw: e.message }, 'e'))
}

function onResponse(p) {
  if (!p) return
  if (p.message) addLog({ raw: (p.application ? p.application + ': ' : '') + p.message })
  if (p.complete) { addLog({ key: 'upd.finished' }); load(false) }
}

let offs = []
onActivated(() => {
  load(false)
  offs = [printer.on('update_response', onResponse), printer.on('update_refreshed', p => { vi.value = p.version_info || {} })]
})
onDeactivated(() => { offs.forEach(f => f()); offs = [] })
</script>

<template>
  <section class="view">
    <div class="row">
      <button @click="load(true)">{{ t('upd.check') }}</button>
      <button :disabled="printer.isPrinting" @click="updateAll">{{ t('upd.all') }}</button>
      <span class="msg">{{ msg }}</span>
    </div>
    <div>
      <div v-for="r in rows" :key="r.name" class="updRow">
        <span class="n" :title="r.name">{{ r.name }}</span>
        <span class="d" :title="r.info">{{ r.info }}</span>
        <span :class="r.need ? 'need' : 'd'" :title="r.status">{{ r.status }}</span>
        <button :disabled="!r.canUpdate || busy || printer.isPrinting" @click="updateOne(r)">{{ t('upd.update') }}</button>
      </div>
    </div>
    <div ref="logEl" class="log ulog">
      <div v-for="l in logLines" :key="l.id" :class="l.cls">{{ tm(l.m) }}</div>
    </div>
  </section>
</template>

<style scoped>
.msg{color:var(--dim);font-size:12px}
.ulog{max-height:160px}
.updRow{display:grid;grid-template-columns:1fr 1.6fr 1fr auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}
.updRow .n{font-weight:500}
.updRow .d{color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.updRow .need{color:var(--red)}
@media(max-width:700px){.updRow{grid-template-columns:1fr auto}}
</style>

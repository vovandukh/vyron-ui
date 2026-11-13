<script setup>
import { computed, ref, shallowRef, onActivated, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'
import { listConfigFiles, readConfigFile, saveConfigWithBackup } from '../../services/moonrakerApi'
import ConfigEditor from './config/ConfigEditor.vue'

const printer = usePrinterStore()
const { ask, confirm, prompt } = useConfirm()
const { t, tm } = useI18n()

const editor = ref(null)
const files = shallowRef([])
const filter = ref('')
const path = ref(null)
const orig = ref('')
const text = ref('')
const isNew = ref(false)
const cursor = ref({ line: 1, col: 1 })
const msg = ref(null) // { m: {key,params}, bad }

const dirty = computed(() => text.value !== orig.value)
const shown = computed(() => {
  const q = filter.value.toLowerCase()
  return files.value.filter(f => f.path.toLowerCase().includes(q))
})
const stat = computed(() => t('cfg.stat', { l: cursor.value.line, c: cursor.value.col, n: text.value.split('\n').length }))

const say = (key, params, bad = false) => { msg.value = { m: { key, params }, bad } }

async function loadList() {
  if (!printer.host) { say('cfg.connectToEdit', null, true); return }
  try {
    files.value = await listConfigFiles(printer.host)
    if (!path.value && files.value.some(f => f.path === 'printer.cfg')) open('printer.cfg', true)
  } catch (e) { say('cfg.listError', { msg: e.message }, true) }
}

async function open(p, force) {
  if (!force && dirty.value && !(await confirm('cfg.discard'))) return
  try {
    const txt = await readConfigFile(printer.host, p)
    path.value = p; orig.value = txt; text.value = txt; isNew.value = false
    msg.value = null
    editor.value?.reset()
  } catch (e) { say('cfg.openError', { msg: e.message }, true) }
}

async function save(restart) {
  if (!path.value || !printer.host) { say('cfg.connect', null, true); return }
  if (!dirty.value && !restart) { say('cfg.noChanges'); return }
  if (restart && !(await ask('cfg.confirmSaveRestart'))) return
  try {
    if (dirty.value) {
      const content = text.value
      await saveConfigWithBackup(printer.host, path.value, content, orig.value, isNew.value)
      orig.value = content; isNew.value = false
      loadList()
      say('cfg.saved')
    }
    if (restart) printer.call('printer.restart', {}).catch(() => {})
  } catch (e) { say('cfg.saveError', { msg: e.message }, true) }
}

async function newFile() {
  const n = ((await prompt('cfg.newName')) || '').trim()
  if (!n) return
  if (!/^[\w./-]+\.(cfg|conf)$/i.test(n)) { say('cfg.badName', null, true); return }
  if (dirty.value && !(await confirm('cfg.discard'))) return
  path.value = n; orig.value = ''; text.value = ''; isNew.value = true
  if (!files.value.some(f => f.path === n)) files.value = [...files.value, { path: n }]
  editor.value?.reset()
  editor.value?.focus()
}

onActivated(() => { if (!files.value.length) loadList() })

const beforeUnload = e => { if (path.value && dirty.value) { e.preventDefault(); e.returnValue = '' } }
onMounted(() => addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <section class="view">
    <div class="ce">
      <aside class="ceSide">
        <input v-model="filter" type="search" :placeholder="t('cfg.search')" :aria-label="t('cfg.search')">
        <div class="ceList">
          <button v-for="f in shown" :key="f.path" class="cef" :class="{ on: f.path === path }" :title="f.path" @click="open(f.path)">{{ f.path }}</button>
        </div>
        <button @click="newFile">{{ t('cfg.new') }}</button>
      </aside>
      <div class="ceMain">
        <div class="ceBar">
          <b>{{ path || '–' }}</b>
          <span v-if="dirty" class="ceDirty">{{ t('cfg.unsaved') }}</span>
          <span class="sp"></span>
          <button @click="editor.toggleFind()">{{ t('cfg.find') }}</button>
          <button @click="save(false)">{{ t('common.save') }}</button>
          <button :disabled="printer.isPrinting" @click="save(true)">{{ t('cfg.saveRestart') }}</button>
        </div>
        <ConfigEditor ref="editor" v-model="text" @save="save(false)" @cursor="cursor = $event" />
        <div class="ceStat">
          <span>{{ stat }}</span>
          <span :class="{ bad: msg && msg.bad }">{{ msg ? tm(msg.m) : '' }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ce{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;flex:1;min-height:0}
.ceSide,.ceMain{display:flex;flex-direction:column;gap:8px;min-height:0}
.ceList{overflow:auto;display:grid;gap:4px;align-content:start;flex:1}
.view .cef{text-align:left;padding:8px 10px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.view .cef.on{border-color:var(--red)}
.ceBar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ceBar b{font-weight:500;font-size:13px}
.ceDirty{color:var(--red);font-size:12px}
.sp{flex:1}
.ceStat{display:flex;justify-content:space-between;gap:12px;color:var(--dim);font-size:12px}
.bad{color:var(--red)}
@media(max-width:700px){.ce{grid-template-columns:1fr}.ceSide{max-height:140px}}
</style>

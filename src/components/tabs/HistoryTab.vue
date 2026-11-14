<script setup>
// Історія: останній друк, G-code файли в пам'яті принтера (3D-перегляд, видалення) та попередні друки.
import { computed, ref, shallowRef, watch, onActivated, onDeactivated } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUiStore } from '../../stores/uiStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'
import { fmtDuration } from '../../utils/format'
import { jobThumbUrl, thumbUrl, listGcodeFiles, fileMetadata, deleteGcodeFile } from '../../services/moonrakerApi'
import { demoHistory, demoFileList, demoFileMeta, demoDeleteFile } from '../../services/demo'
import { DEMO_BUILD } from '../../config'

const PAGE = 30          // скільки файлів показувати за раз (метадані вантажаться лише для видимих)
const META_PARALLEL = 4  // одночасних запитів метаданих

const printer = usePrinterStore()
const settings = useSettingsStore()
const ui = useUiStore()
const { confirm } = useConfirm()
const { t, tm } = useI18n()

const jobs = shallowRef([])
const totals = shallowRef(null)
const files = shallowRef([])
const meta = shallowRef({})          // path → metadata
const msg = ref(null)                // { m, bad }
const loaded = ref(false)
const filesLoaded = ref(false)
const badThumb = ref(false)
const badThumbs = ref({})
const query = ref('')
const limit = ref(PAGE)
const deleting = ref(null)

const say = (m, bad = false) => { msg.value = { m, bad } }

// ---------- форматування ----------
const HIST = {
  completed: ['✓', 'hist.completed', 'hok'], cancelled: ['✕', 'state.cancelled', 'hmid'],
  klippy_shutdown: ['!', 'state.error', 'hbad'], klippy_disconnect: ['!', 'hist.interrupted', 'hbad'],
  error: ['!', 'state.error', 'hbad'], interrupted: ['!', 'hist.interrupted', 'hbad'], in_progress: ['●', 'hist.inProgress', 'hok'],
  server_exit: ['!', 'hist.interrupted', 'hbad']   // Moonraker перезапустився під час друку
}
const info = s => {
  const h = HIST[s]
  return h ? { icon: h[0], text: t(h[1]), cls: h[2] } : { icon: '?', text: s || '–', cls: 'hmid' }
}
const locale = () => (settings.lang === 'en' ? 'en-GB' : 'uk-UA')
const date = ts => (ts ? new Date(ts * 1000).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) : '–')
const shortDate = ts => (ts ? new Date(ts * 1000).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) : '–')
const fname = p => String(p || '–').split('/').pop()
const meters = (mm, d) => (mm ? t('unit.m', { v: (mm / 1000).toFixed(d) }) : '–')
const size = b => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' ' + t('files.mb') : Math.max(1, Math.round(b / 1024)) + ' ' + t('files.kb'))

// ---------- стан друку: файл, який друкується або на паузі, видаляти не можна ----------
const busyFile = computed(() => {
  const ps = printer.st.print_stats || {}
  return ['printing', 'paused'].includes(ps.state) ? ps.filename || null : null
})
const isBusy = path => !!path && path === busyFile.value

/**
 * Moonraker заповнює тривалість і філамент у history лише після завершення завдання,
 * тож для поточного друку беремо живі значення з print_stats.
 */
function withLive(j) {
  const ps = printer.st.print_stats || {}
  if (j.status !== 'in_progress' || !ps.filename || j.filename !== ps.filename) return j
  return { ...j, print_duration: ps.print_duration, total_duration: ps.total_duration, filament_used: ps.filament_used }
}

/** filename → { last: останній запис історії, count: скільки разів друкувався } */
const byFile = computed(() => {
  const m = {}
  for (const j of jobs.value) {
    const e = m[j.filename] || (m[j.filename] = { last: j, count: 0 })
    e.count++
  }
  return m
})
const fileSet = computed(() => new Set(files.value.map(f => f.path)))
/** Файл є в пам'яті принтера: за списком файлів, а поки він не завантажився — за полем exists з історії. */
const exists = (path, job) => (filesLoaded.value ? fileSet.value.has(path) : job ? job.exists !== false : false)

const last = computed(() => {
  const j = jobs.value[0] && withLive(jobs.value[0])
  if (!j) return null
  const md = j.metadata || {}
  return {
    ...info(j.status), path: j.filename, file: fname(j.filename), exists: exists(j.filename, j),
    thumb: (DEMO_BUILD && printer.demoMode) ? demoFileMeta(j.filename).__thumb || null : jobThumbUrl(printer.host, j),
    fields: [
      ['hist.started', date(j.start_time)],
      ['hist.duration', fmtDuration(j.print_duration, t)],
      ['hist.total', fmtDuration(j.total_duration, t)],
      ['hist.filament', meters(j.filament_used, 2)],
      ['hist.layers', md.layer_count || '–'],
      ['hist.height', md.object_height ? t('unit.mm', { v: md.object_height }) : '–']
    ]
  }
})

const rest = computed(() => jobs.value.slice(1).map((r, i) => ({
  id: r.job_id || i, ...info(r.status), path: r.filename, file: fname(r.filename), date: date(r.start_time),
  dur: fmtDuration(r.print_duration, t), fil: meters(r.filament_used, 1), exists: exists(r.filename, r)
})))

const totText = computed(() => {
  const j = totals.value
  if (!j || j.total_jobs == null) return ''
  return t('hist.totals', { n: j.total_jobs, time: fmtDuration(j.total_print_time, t), fil: ((j.total_filament_used || 0) / 1000).toFixed(1) })
})

// ---------- файли ----------
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? files.value.filter(f => f.path.toLowerCase().includes(q)) : files.value
})
const visible = computed(() => filtered.value.slice(0, limit.value).map(f => {
  const m = meta.value[f.path] || null, h = byFile.value[f.path]
  const parts = [size(f.size)]
  if (m && m.estimated_time) parts.push(fmtDuration(m.estimated_time, t))
  if (m && m.layer_height) parts.push(t('unit.mm', { v: m.layer_height }))
  if (m && m.filament_type) parts.push(m.filament_type)
  return {
    ...f, name: fname(f.path), dir: f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '',
    sub: parts.join(' · '),
    thumb: badThumbs.value[f.path] ? null : m ? m.__thumb || thumbUrl(printer.host, f.path, m, 48) : null,
    hist: h ? { ...info(h.last.status), date: shortDate(h.last.start_time), count: h.count } : null,
    busy: isBusy(f.path)
  }
}))
watch(query, () => { limit.value = PAGE })

// Метадані — лише для видимих рядків, не більше META_PARALLEL запитів одночасно.
const pending = new Set()
let active = 0
function pumpMeta() {
  if ((DEMO_BUILD && printer.demoMode)) return
  for (const f of visible.value) {
    if (active >= META_PARALLEL) return
    if (meta.value[f.path] || pending.has(f.path)) continue
    pending.add(f.path); active++
    fileMetadata(printer.host, f.path)
      .then(m => { meta.value = { ...meta.value, [f.path]: m } })
      .catch(() => { meta.value = { ...meta.value, [f.path]: {} } })
      .finally(() => { pending.delete(f.path); active--; pumpMeta() })
  }
}
watch(visible, pumpMeta)

async function loadFiles() {
  if ((DEMO_BUILD && printer.demoMode)) {
    files.value = demoFileList()
    meta.value = Object.fromEntries(files.value.map(f => [f.path, demoFileMeta(f.path)]))
    filesLoaded.value = true
    return
  }
  if (!printer.host) return
  try {
    files.value = await listGcodeFiles(printer.host)
    filesLoaded.value = true
  } catch (e) { say({ key: 'files.listError', params: { msg: e.message } }, true) }
}

function load() {
  badThumb.value = false
  msg.value = null
  loadFiles()
  if ((DEMO_BUILD && printer.demoMode)) {
    const d = demoHistory()
    jobs.value = d.jobs; totals.value = d.totals; loaded.value = true
    return
  }
  printer.call('server.history.list', { limit: 50, order: 'desc' })
    .then(r => { jobs.value = r.jobs || []; loaded.value = true })
    .catch(e => say({ key: 'hist.unavailable', params: { msg: e.message } }, true))
  printer.call('server.history.totals', {})
    .then(r => { totals.value = r.job_totals || {} })
    .catch(() => {})
}

// ---------- дії ----------
/**
 * Запуск друку: недоступний, поки принтер друкує або на паузі, чи немає підключення.
 * Повертає текст підказки-причини або '' (можна друкувати).
 */
const printBlock = computed(() => {
  if (printer.printBusy) return t('files.printBusy')
  if (!(DEMO_BUILD && printer.demoMode) && !printer.connected) return t('msg.notConnectedPrinter')
  return ''
})
const starting = ref(false)

async function print(path) {
  if (printBlock.value || starting.value) return
  // Підтвердження обов'язкове завжди (не залежить від налаштування «підтверджувати системні дії»).
  if (!(await confirm({ key: 'files.confirmPrint', params: { name: fname(path) } }))) return
  if (printer.printBusy) { say({ key: 'files.printBusy' }, true); return }   // друк міг стартувати, поки було відкрите вікно
  starting.value = true
  try {
    await printer.startPrint(path)
    say({ key: 'files.printStarted', params: { name: fname(path) } })
    ui.go('main')
  } catch (e) {
    say({ key: 'files.printError', params: { msg: e.message } }, true)
  } finally {
    starting.value = false
  }
}

function open3d(path) {
  printer.openPreview(path)
  ui.go('main')
}

async function remove(path) {
  if (isBusy(path) || deleting.value) return
  if (!(await confirm({ key: 'files.confirmDelete', params: { name: fname(path) } }))) return
  if (isBusy(path)) { say({ key: 'files.busy' }, true); return }   // друк міг стартувати, поки було відкрите вікно
  deleting.value = path
  try {
    if ((DEMO_BUILD && printer.demoMode)) demoDeleteFile(path)
    else await deleteGcodeFile(printer.host, path)
    files.value = files.value.filter(f => f.path !== path)
    if (printer.preview && printer.preview.name === path) printer.closePreview()
    say({ key: 'files.deleted', params: { name: fname(path) } })
  } catch (e) {
    say({ key: 'files.deleteError', params: { msg: e.message } }, true)
  } finally {
    deleting.value = null
  }
}

// ---------- життєвий цикл ----------
let offs = [], fileTimer = null
onActivated(() => {
  load()
  offs = [
    printer.on('history_changed', load),
    // інший клієнт додав/видалив файл — оновити список (з невеликою затримкою, подій буває кілька підряд)
    printer.on('filelist_changed', () => { clearTimeout(fileTimer); fileTimer = setTimeout(loadFiles, 600) })
  ]
})
onDeactivated(() => { offs.forEach(f => f()); offs = []; clearTimeout(fileTimer) })
</script>

<template>
  <section class="view">
    <div class="row">
      <button @click="load">{{ t('hist.refresh') }}</button>
      <span v-if="msg" class="msg" :class="{ bad: msg.bad }">{{ tm(msg.m) }}</span>
    </div>

    <div v-if="loaded && !last">{{ t('hist.empty') }}</div>
    <div v-if="last" class="histCard">
      <img v-if="last.thumb && !badThumb" :src="last.thumb" alt="" @error="badThumb = true">
      <div class="body">
        <div class="histSt" :class="last.cls">{{ last.icon }} {{ last.text }}</div>
        <div class="histFile">{{ last.file }}</div>
        <dl class="histF">
          <div v-for="[k, v] in last.fields" :key="k"><dt>{{ t(k) }}</dt><dd>{{ v }}</dd></div>
        </dl>
        <div v-if="last.exists" class="acts">
          <button class="pr" :disabled="!!printBlock || starting" :title="printBlock || t('files.printTitle')" @click="print(last.path)">{{ t('files.reprint') }}</button>
          <button @click="open3d(last.path)">{{ t('files.preview') }}</button>
          <button class="del" :disabled="isBusy(last.path) || !!deleting" :title="isBusy(last.path) ? t('files.busy') : t('files.deleteTitle')" @click="remove(last.path)">{{ t('files.delete') }}</button>
        </div>
        <div v-else-if="filesLoaded" class="gone">{{ t('files.removed') }}</div>
      </div>
    </div>
    <div class="tot">{{ totText }}</div>

    <!-- G-code файли в пам'яті принтера -->
    <div class="fhead">
      <span class="listTitle">{{ t('files.title', { n: files.length }) }}</span>
      <input v-model="query" type="search" class="fsearch" :placeholder="t('files.search')" :aria-label="t('files.search')">
    </div>
    <div v-if="filesLoaded && !files.length" class="empty">{{ t('files.empty') }}</div>
    <div class="files">
      <div v-for="(f, i) in visible" :key="f.path" class="frow" :class="{ busy: f.busy }" :style="{ '--i': i % 24 }">
        <div class="th">
          <img v-if="f.thumb" :src="f.thumb" alt="" loading="lazy" @error="badThumbs = { ...badThumbs, [f.path]: true }">
        </div>
        <div class="fi">
          <div class="fn" :title="f.path"><span v-if="f.dir" class="fdir">{{ f.dir }}/</span>{{ f.name }}</div>
          <div class="fs">
            {{ f.sub }}
            <template v-if="f.busy"> · <span class="hok">{{ t('files.printing') }}</span></template>
            <template v-else-if="f.hist"> · <span :class="f.hist.cls" :title="f.hist.text">{{ f.hist.icon }}</span> {{ f.hist.date }}<template v-if="f.hist.count > 1"> ×{{ f.hist.count }}</template></template>
          </div>
        </div>
        <div class="fa">
          <button class="pr" :disabled="!!printBlock || starting" :aria-label="t('files.print')" :title="printBlock || t('files.printTitle')" @click="print(f.path)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l12-7z" /></svg><span class="pr-l">{{ t('files.print') }}</span>
          </button>
          <button :title="t('files.previewTitle')" @click="open3d(f.path)">{{ t('files.preview') }}</button>
          <button class="del" :disabled="f.busy || !!deleting" :aria-label="t('files.deleteTitle')"
                  :title="f.busy ? t('files.busy') : t('files.deleteTitle')" @click="remove(f.path)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
          </button>
        </div>
      </div>
    </div>
    <button v-if="filtered.length > limit" class="more" @click="limit += PAGE">{{ t('files.more', { n: filtered.length - limit }) }}</button>

    <div v-if="rest.length" class="listTitle">{{ t('hist.prevTitle') }}</div>
    <div>
      <div v-for="(r, i) in rest" :key="r.id" class="histRow" :style="{ '--i': Math.min(i, 16) }">
        <span :class="r.cls" :title="r.text">{{ r.icon }}</span>
        <span class="f" :title="r.path">{{ r.file }}<span v-if="!r.exists && filesLoaded" class="gone"> · {{ t('files.removed') }}</span></span>
        <span class="d">{{ r.date }}</span>
        <span class="d">{{ r.dur }}</span>
        <span class="d">{{ r.fil }}</span>
        <span class="ra">
          <button class="mini pr" :disabled="!r.exists || !!printBlock || starting" :aria-label="t('files.reprint')"
                  :title="!r.exists ? t('files.removed') : printBlock || t('files.printTitle')" @click="print(r.path)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l12-7z" /></svg>
          </button>
          <button class="mini" :disabled="!r.exists" :title="r.exists ? t('files.previewTitle') : t('files.removed')" @click="open3d(r.path)">{{ t('files.preview') }}</button>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.msg{color:var(--dim);font-size:12px}
.msg.bad{color:var(--red)}
.tot{color:var(--dim);font-size:13px}
.listTitle{font-size:12px;color:var(--dim);margin-top:6px}
.histCard{display:flex;gap:16px;align-items:flex-start;padding:16px;border:1px solid var(--hair);border-radius:var(--r-lg);background:var(--surface)}
.histCard img{width:140px;height:140px;object-fit:contain;border-radius:var(--r-md);background:rgba(255,255,255,.03);flex:none}
.body{flex:1;min-width:0}
.histSt{font-size:22px;font-weight:300;margin-bottom:2px}
.histFile{color:var(--dim);font-size:13px;margin-bottom:12px;word-break:break-all}
.histF{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin:0}
.histF dt{font-size:12px;color:var(--dim)}
.histF dd{margin:2px 0 0;font-size:16px;font-weight:300}
.acts{display:flex;gap:8px;margin-top:12px}
.gone{color:var(--dim);font-size:11px}
.body > .gone{margin-top:10px}

.fhead{display:flex;align-items:center;gap:10px;margin-top:6px}
.fhead .listTitle{margin:0;flex:1}
.view .fsearch{width:200px;padding:6px 10px}
.empty{color:var(--dim);font-size:12px}
.files{display:grid;gap:2px}
.frow{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:7px 10px;border-radius:var(--r-md);transition:background-color var(--t-fast) var(--ease-out)}
.frow:hover{background:var(--surface-hi)}
/* Легка каскадна поява рядків (лише при вставці в DOM: завантаження, «Показати ще», пошук) */
.frow,.histRow,.histCard{animation:row-in var(--t-mid) var(--ease-out) both;animation-delay:calc(var(--i, 0) * 22ms)}
@keyframes row-in{from{opacity:0;transform:translateY(6px)}}
.frow.busy{background:rgba(52,199,89,.07);box-shadow:inset 3px 0 0 #34c759}
.th{width:44px;height:44px;border-radius:var(--r-sm);background:rgba(255,255,255,.03);overflow:hidden;display:grid;place-items:center}
.th img{width:100%;height:100%;object-fit:contain}
.fi{min-width:0}
.fn{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fdir{color:var(--dim)}
.fs{color:var(--dim);font-size:11px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fa{display:flex;gap:6px}
.view .fa button{padding:6px 10px}
.view .del svg{width:15px;height:15px;display:block;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
/* «Друкувати»: червоний акцент, як основна дія */
.view .pr{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(180deg,#ff5a4c,#e0321f);border-color:transparent;color:#fff;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 4px 14px -6px rgba(240,58,46,.8)}
.view .pr:not(:disabled):hover{background:linear-gradient(180deg,#ff6a5c,#e83a27);border-color:transparent}
.view .pr:disabled{background:var(--surface-hi);box-shadow:none;color:var(--dim)}
.view .pr svg{width:12px;height:12px;display:block;fill:#fff}
.view .pr:disabled svg{fill:var(--dim)}
.ra{display:flex;gap:6px}
.view .del:hover:not(:disabled){color:var(--red)}
.more{align-self:flex-start}

.histRow{display:grid;grid-template-columns:22px minmax(0,1fr) auto auto auto auto;gap:14px;align-items:center;padding:8px 10px;border-radius:var(--r-md);font-size:13px;transition:background-color var(--t-fast) var(--ease-out)}
.histRow:hover{background:var(--surface-hi)}
.histRow .f{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.histRow .d{color:var(--dim);white-space:nowrap}
.view .mini{padding:5px 10px;font-size:11px;border-radius:999px}
.hok{color:#8fe3a8}.hbad{color:var(--red)}.hmid{color:var(--dim)}
@media(max-width:900px){.pr-l{display:none}}
@media(max-width:700px){
  .histCard{flex-direction:column}
  .histRow{grid-template-columns:22px minmax(0,1fr) auto auto}
  .histRow .d:nth-of-type(n+3){display:none}
  .view .fsearch{width:140px}
}
</style>

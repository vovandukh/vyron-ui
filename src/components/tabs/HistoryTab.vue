<script setup>
import { computed, ref, shallowRef, onActivated, onDeactivated } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../composables/useI18n'
import { fmtDuration } from '../../utils/format'
import { jobThumbUrl } from '../../services/moonrakerApi'
import { demoHistory } from '../../services/demo'

const printer = usePrinterStore()
const settings = useSettingsStore()
const { t } = useI18n()

const jobs = shallowRef([])
const totals = shallowRef(null)
const msg = ref('')
const loaded = ref(false)
const badThumb = ref(false)

const HIST = {
  completed: ['✓', 'hist.completed', 'hok'], cancelled: ['✕', 'state.cancelled', 'hmid'],
  klippy_shutdown: ['!', 'state.error', 'hbad'], klippy_disconnect: ['!', 'hist.interrupted', 'hbad'],
  error: ['!', 'state.error', 'hbad'], interrupted: ['!', 'hist.interrupted', 'hbad'], in_progress: ['●', 'hist.inProgress', 'hok']
}
const info = s => {
  const h = HIST[s]
  return h ? { icon: h[0], text: t(h[1]), cls: h[2] } : { icon: '?', text: s || '–', cls: 'hmid' }
}
const date = ts => (ts ? new Date(ts * 1000).toLocaleString(settings.lang === 'en' ? 'en-GB' : 'uk-UA', { dateStyle: 'medium', timeStyle: 'short' }) : '–')
const fname = j => String(j.filename || '–').split('/').pop()
const meters = (mm, d) => (mm ? t('unit.m', { v: (mm / 1000).toFixed(d) }) : '–')

const last = computed(() => {
  const j = jobs.value[0]
  if (!j) return null
  const md = j.metadata || {}
  return {
    ...info(j.status), file: fname(j), thumb: jobThumbUrl(printer.host, j),
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
  id: r.job_id || i, ...info(r.status), file: fname(r), date: date(r.start_time),
  dur: fmtDuration(r.print_duration, t), fil: meters(r.filament_used, 1)
})))

const totText = computed(() => {
  const j = totals.value
  if (!j || j.total_jobs == null) return ''
  return t('hist.totals', { n: j.total_jobs, time: fmtDuration(j.total_print_time, t), fil: ((j.total_filament_used || 0) / 1000).toFixed(1) })
})

function load() {
  badThumb.value = false
  if (printer.demoMode) {
    const d = demoHistory()
    jobs.value = d.jobs; totals.value = d.totals; loaded.value = true
    return
  }
  msg.value = ''
  printer.call('server.history.list', { limit: 20, order: 'desc' })
    .then(r => { jobs.value = r.jobs || []; loaded.value = true })
    .catch(e => { msg.value = t('hist.unavailable', { msg: e.message }) })
  printer.call('server.history.totals', {})
    .then(r => { totals.value = r.job_totals || {} })
    .catch(() => {})
}

let off = null
onActivated(() => { load(); off = printer.on('history_changed', load) })
onDeactivated(() => { off?.(); off = null })
</script>

<template>
  <section class="view">
    <div class="row"><button @click="load">{{ t('hist.refresh') }}</button><span class="msg">{{ msg }}</span></div>
    <div v-if="loaded && !last">{{ t('hist.empty') }}</div>
    <div v-if="last" class="histCard">
      <img v-if="last.thumb && !badThumb" :src="last.thumb" alt="" @error="badThumb = true">
      <div class="body">
        <div class="histSt" :class="last.cls">{{ last.icon }} {{ last.text }}</div>
        <div class="histFile">{{ last.file }}</div>
        <dl class="histF">
          <div v-for="[k, v] in last.fields" :key="k"><dt>{{ t(k) }}</dt><dd>{{ v }}</dd></div>
        </dl>
      </div>
    </div>
    <div class="tot">{{ totText }}</div>
    <div v-if="rest.length" class="listTitle">{{ t('hist.prevTitle') }}</div>
    <div>
      <div v-for="r in rest" :key="r.id" class="histRow">
        <span :class="r.cls" :title="r.text">{{ r.icon }}</span>
        <span class="f" :title="r.file">{{ r.file }}</span>
        <span class="d">{{ r.date }}</span>
        <span class="d">{{ r.dur }}</span>
        <span class="d">{{ r.fil }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.msg{color:var(--dim);font-size:12px}
.tot{color:var(--dim);font-size:13px}
.listTitle{font-size:12px;color:var(--dim);margin-top:6px}
.histCard{display:flex;gap:16px;align-items:flex-start;padding:14px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.02)}
.histCard img{width:140px;height:140px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,.03);flex:none}
.body{flex:1;min-width:0}
.histSt{font-size:22px;font-weight:300;margin-bottom:2px}
.histFile{color:var(--dim);font-size:13px;margin-bottom:12px;word-break:break-all}
.histF{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin:0}
.histF dt{font-size:12px;color:var(--dim)}
.histF dd{margin:2px 0 0;font-size:16px;font-weight:300}
.histRow{display:grid;grid-template-columns:22px minmax(0,1fr) auto auto auto;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}
.histRow .f{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.histRow .d{color:var(--dim);white-space:nowrap}
.hok{color:#7ddc9a}.hbad{color:var(--red)}.hmid{color:var(--dim)}
@media(max-width:700px){.histCard{flex-direction:column}.histRow{grid-template-columns:22px minmax(0,1fr) auto}.histRow .d:nth-of-type(n+3){display:none}}
</style>

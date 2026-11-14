<script setup>
import { computed, ref, shallowRef, watch, onActivated, onDeactivated } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useI18n } from '../../composables/useI18n'
import BedMesh3D from '../viz/BedMesh3D.vue'
import BedMeshGrid from '../viz/BedMeshGrid.vue'
import { useConfirm } from '../../composables/useConfirm'

const printer = usePrinterStore()
const { t } = useI18n()
const { confirm } = useConfirm()

const active = ref(true)
onActivated(() => { active.value = true })
onDeactivated(() => { active.value = false })

/** Актуальна карта: probed → mesh_matrix → збережений профіль (default або перший). */
const parsed = computed(() => {
  const m = printer.st.bed_mesh || {}
  let mx = m.probed_matrix && m.probed_matrix.length ? m.probed_matrix : m.mesh_matrix
  let name = m.profile_name, saved = false
  if (!mx || !mx.length) {
    const ks = Object.keys(m.profiles || {}), p = ks.includes('default') ? 'default' : ks[0]
    if (!p) return null
    name = p; mx = m.profiles[p].points; saved = true
  }
  if (!Array.isArray(mx) || !Array.isArray(mx[0])) return null
  mx = mx.map(r => r.map(Number))
  if (mx.some(r => r.some(v => !Number.isFinite(v)))) return null
  const flat = mx.flat(), lo = Math.min(...flat), hi = Math.max(...flat)
  const lim = Math.max(Math.abs(lo), Math.abs(hi), 0.02)
  return { mx, name, saved, lo, hi, lim, key: JSON.stringify(mx) + name }
})

// Остання валідна карта лишається на екрані, навіть якщо наступний статус її не містить.
const mesh = shallowRef(null)
const calSent = ref(false)
watch(parsed, p => {
  if (p && (!mesh.value || p.key !== mesh.value.key)) { mesh.value = p; calSent.value = false }
}, { immediate: true })

/** Зберегти поточну карту як профіль default і записати printer.cfg (SAVE_CONFIG перезапускає Klipper — питаємо завжди). */
async function saveProfile() {
  if (!(await confirm('mesh.saveConfirm'))) return
  printer.consoleSend('BED_MESH_PROFILE SAVE=default')
  printer.consoleSend('SAVE_CONFIG')
}

function calibrate() {
  printer.consoleSend('BED_MESH_CALIBRATE')
  calSent.value = true
}
</script>

<template>
  <section class="view">
    <div class="mbar">
      <button class="primary" :disabled="printer.isPrinting" @click="calibrate">{{ t('mesh.calibrate') }}</button>
      <button :disabled="printer.isPrinting || !mesh || mesh.saved" @click="saveProfile">{{ t('mesh.save') }}</button>
      <span v-if="calSent" class="muted">{{ t('mesh.calSent') }}</span>
    </div>
    <!-- Статистика відхилень: табличні цифри, щоб значення не «стрибали» -->
    <div v-if="mesh" class="stats">
      <div class="chip"><small>{{ t('mesh.profile') }}</small><b>{{ mesh.name || '–' }}<i v-if="mesh.saved">{{ t('mesh.savedShort') }}</i></b></div>
      <div class="chip"><small>{{ t('mesh.min') }}</small><b class="lo">{{ mesh.lo.toFixed(3) }}</b></div>
      <div class="chip"><small>{{ t('mesh.max') }}</small><b class="hi">{{ mesh.hi.toFixed(3) }}</b></div>
      <div class="chip"><small>{{ t('mesh.range') }}</small><b>{{ (mesh.hi - mesh.lo).toFixed(3) }}</b></div>
      <div class="chip"><small>{{ t('mesh.exag') }}</small><b>×{{ Math.round(40 / mesh.lim) }}</b></div>
    </div>
    <div class="meshwrap">
      <BedMesh3D :matrix="mesh ? mesh.mx : null" :lim="mesh ? mesh.lim : 0.02" :active="active" />
      <div class="card side">
        <BedMeshGrid v-if="mesh" :matrix="mesh.mx" :lim="mesh.lim" />
        <div v-else class="empty">{{ t('mesh.none') }}</div>
      </div>
    </div>
    <span class="muted">{{ t('mesh.front') }}</span>
  </section>
</template>

<style scoped>
.mbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.stats{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:grid;gap:3px;padding:8px 14px;border-radius:var(--r-md);background:var(--surface);border:1px solid var(--hair);min-width:84px}
.chip small{font-size:10px;color:var(--dim);letter-spacing:.04em;text-transform:uppercase}
.chip b{font-size:15px;font-weight:300;white-space:nowrap}
.chip i{font-style:normal;font-size:10px;color:var(--dim);margin-left:6px}
.chip .lo{color:var(--ice)}
.chip .hi{color:var(--coral)}
.meshwrap{display:grid;grid-template-columns:1fr minmax(280px,400px);gap:14px;flex:1;min-height:0}
.side{min-height:0;overflow:auto;padding:10px}
.empty{font-size:12px;color:var(--dim)}
/* Ландшафтні екрани принтера (800×480, 1024×600): дві колонки, щоб і 3D, і таблиця були видні без прокрутки.
   Вузькі (портретні) екрани: одна колонка, панель прокручується, блок не стискається поверх підпису. */
@media(max-width:900px){.meshwrap{grid-template-columns:1fr minmax(220px,320px);gap:10px}.chip{padding:6px 10px;min-width:0}.chip b{font-size:13px}}
@media(max-width:700px){.meshwrap{grid-template-columns:1fr;flex:none}}
@media(max-height:540px){.stats{display:none}}
</style>

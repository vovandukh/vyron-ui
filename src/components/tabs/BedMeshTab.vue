<script setup>
import { computed, ref, shallowRef, watch, onActivated, onDeactivated } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useI18n } from '../../composables/useI18n'
import BedMesh3D from '../viz/BedMesh3D.vue'
import BedMeshGrid from '../viz/BedMeshGrid.vue'

const printer = usePrinterStore()
const { t } = useI18n()

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

const info = computed(() => {
  if (calSent.value) return t('mesh.calSent')
  const m = mesh.value
  if (!m) return ''
  return t('mesh.info', {
    name: m.name || '–', saved: m.saved ? t('mesh.savedSuffix') : '',
    lo: m.lo.toFixed(3), hi: m.hi.toFixed(3), range: (m.hi - m.lo).toFixed(3), k: Math.round(40 / m.lim)
  })
})

function calibrate() {
  printer.consoleSend('BED_MESH_CALIBRATE')
  calSent.value = true
}
</script>

<template>
  <section class="view">
    <div class="row"><button :disabled="printer.isPrinting" @click="calibrate">{{ t('mesh.calibrate') }}</button><span>{{ info }}</span></div>
    <div class="meshwrap">
      <BedMesh3D :matrix="mesh ? mesh.mx : null" :lim="mesh ? mesh.lim : 0.02" :active="active" />
      <BedMeshGrid v-if="mesh" :matrix="mesh.mx" :lim="mesh.lim" />
      <div v-else class="empty">{{ t('mesh.none') }}</div>
    </div>
    <span class="muted">{{ t('mesh.front') }}</span>
  </section>
</template>

<style scoped>
.meshwrap{display:grid;grid-template-columns:1fr minmax(280px,400px);gap:18px;flex:1;min-height:0}
.empty{font-size:11px}
@media(max-width:900px){.meshwrap{grid-template-columns:1fr}}
</style>

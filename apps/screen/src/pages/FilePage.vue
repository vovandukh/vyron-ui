<script setup>
// Сторінка файлу: мініатюра зі слайсера, назва, час друку, матеріал, шар — і «Друкувати».
// Звичайна сторінка навігації («‹ Файли» повертає до списку), у тому самому склі, що й головна.
import { computed, onMounted, ref } from 'vue'
import { fmtDuration } from '@vyron/shared/format'
import { usePrinter } from '../store'
import { t } from '../i18n'
import { whenOnline } from '../online'
import Icon from '../components/Icon.vue'
import ConfirmSheet from '../components/ConfirmSheet.vue'

const p = usePrinter()
const meta = ref(null)
const thumb = ref('')
const starting = ref(false)
const askDel = ref(false)
async function del() {
  askDel.value = false
  if (await p.deleteFile(path.value)) p.back()
}
const path = computed(() => (p.selFile && p.selFile.path) || '')
const name = computed(() => path.value.replace(/^.*\//, '').replace(/\.(gcode|g|gco)$/i, ''))
// Після перезавантаження вибір файлу не зберігається — повертаємось до списку
onMounted(() => { if (!path.value) p.back() })
const folder = computed(() => (path.value.includes('/') ? path.value.slice(0, path.value.lastIndexOf('/')) : ''))

whenOnline(async () => {
  if (!path.value) return
  const m = await p.fileMeta(path.value)
  meta.value = m
  thumb.value = p.thumbUrl(path.value, m)
})

const rows = computed(() => {
  const m = meta.value || {}
  return [
    m.estimated_time && { k: t('scr.est'), v: fmtDuration(m.estimated_time, t) },
    (m.filament_type || m.filament_weight_total) && { k: t('scr.fil'), v: [m.filament_type, m.filament_weight_total && Math.round(m.filament_weight_total) + ' г'].filter(Boolean).join(' · ') },
    m.layer_height && { k: t('scr.layerH'), v: m.layer_height + ' ' + t('tune.mm') }
  ].filter(Boolean)
})

async function print() {
  if (starting.value || !path.value) return
  starting.value = true
  await p.printFile(path.value)
  starting.value = false
}
</script>

<template>
  <div class="page fp">
    <section class="card glass">
      <div class="th">
        <img v-if="thumb" :src="thumb" alt="" @error="thumb = ''">
        <Icon v-else name="cube" size="3.6rem" :stroke="1.5" />
      </div>
      <div class="info">
        <small v-if="folder" class="dir">{{ folder }}</small>
        <b class="fn">{{ name }}</b>
        <dl v-if="rows.length">
          <template v-for="r in rows" :key="r.k"><dt>{{ r.k }}</dt><dd>{{ r.v }}</dd></template>
        </dl>
        <span v-else-if="!meta" class="ld">…</span>
      </div>
    </section>

    <p v-if="p.active" class="note">{{ t('scr.filesBusy') }}</p>
    <!-- Ті самі скляні кнопки, що «Пауза / Скасувати» на головній: колір лише в іконці -->
    <footer class="acts">
      <button type="button" class="btn glass del tap" :disabled="starting" @click="askDel = true">
        <Icon name="trash" size="1.7rem" :stroke="2.2" />{{ t('files.delete') }}
      </button>
      <button type="button" class="btn glass go tap" :disabled="starting || p.active" @click="print">
        <Icon name="play" size="1.7rem" :stroke="2.4" />{{ t('scr.print') }}
      </button>
    </footer>
    <ConfirmSheet v-if="askDel" :text="t('scr.deleteQ', { name })" :ok="t('files.delete')" :cancel="t('common.cancel')" @ok="del" @cancel="askDel = false" />
  </div>
</template>

<style scoped>
.fp{display:flex;flex-direction:column;gap:1rem;padding:.4rem 1.2rem 1.2rem}
.card{flex:1;min-height:0;display:flex;gap:1.4rem;padding:1.2rem;border-radius:var(--r-lg)}
/* Мініатюра на легкому затемненні — як модель у картці друку на головній */
.th{flex:none;height:100%;aspect-ratio:1;max-height:15rem;border-radius:var(--r);background:rgba(0,0,0,.28);display:grid;place-items:center;color:var(--dim2);overflow:hidden}
.th img{width:100%;height:100%;object-fit:contain}
.info{flex:1;min-width:0;display:grid;align-content:center;gap:.4rem}
.dir{font-size:1.1rem;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fn{font-size:1.9rem;font-weight:700;line-height:1.2;letter-spacing:-.02em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
dl{margin:.6rem 0 0;padding-top:.8rem;border-top:1px solid var(--line);display:grid;grid-template-columns:auto 1fr;gap:.35rem 1rem;font-size:1.25rem}
dt{color:var(--dim)}
dd{margin:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ld{color:var(--dim);font-size:1.4rem}
.acts{flex:none;display:flex;gap:.8rem}
.btn{flex:1;height:5rem;border-radius:var(--r);display:flex;align-items:center;justify-content:center;gap:.7rem;font-size:1.5rem;font-weight:600}
.btn.go{flex:1.6}
.btn.go .ic{color:var(--coral)}
.btn.del .ic{color:var(--red)}
.note{margin:0}
</style>

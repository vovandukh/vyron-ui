<script setup>
// Файли G-code на принтері (новіші першими) і запуск друку. Дотик до файлу — вікно з мініатюрою зі слайсера,
// часом друку, матеріалом і шаром; «Друкувати» запускає друк і повертає на головну.
// Під час друку новий файл не запустити (Klipper теж не дозволить).
import { ref } from 'vue'
import { fmtDuration } from '@vyron/shared/format'
import { usePrinter } from '../store'
import { t, lang } from '../i18n'
import { whenOnline } from '../online'
import Row from '../components/Row.vue'
import Icon from '../components/Icon.vue'

const p = usePrinter()
const files = ref(null)          // null — ще вантажиться
const pick = ref(null)           // { path, meta, thumb }
const starting = ref(false)

whenOnline(async () => { try { files.value = await p.listFiles() } catch { files.value = [] } })

const name = path => path.replace(/^.*\//, '').replace(/\.(gcode|g|gco)$/i, '')
const folder = path => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
const size = b => (b > 1048576 ? (b / 1048576).toFixed(1) + ' ' + t('files.mb') : Math.round(b / 1024) + ' ' + t('files.kb'))
function when(sec) {
  const d = new Date(sec * 1000), now = new Date()
  if (d.toDateString() === now.toDateString()) return t('scr.today') + ' ' + d.toLocaleTimeString(lang.value, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString(lang.value, { day: 'numeric', month: 'short' })
}

async function open(f) {
  pick.value = { path: f.path, meta: null, thumb: '' }
  const meta = await p.fileMeta(f.path)
  if (pick.value && pick.value.path === f.path) pick.value = { path: f.path, meta, thumb: p.thumbUrl(f.path, meta) }
}
async function print() {
  if (!pick.value || starting.value) return
  starting.value = true
  const ok = await p.printFile(pick.value.path)
  starting.value = false
  if (ok) pick.value = null
}
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.files') }}</h1>
    <p v-if="p.active" class="note">{{ t('scr.filesBusy') }}</p>

    <div v-if="files === null" class="grp skel"><span v-for="i in 4" :key="i"></span></div>
    <p v-else-if="!files.length" class="grp-f">{{ t('files.empty') }}</p>
    <div v-else class="grp">
      <Row v-for="f in files" :key="f.path" icon="files" :label="name(f.path)" chevron :disabled="p.active" @tap="open(f)">
        <template #sub><small class="sub">{{ [folder(f.path), when(f.modified), size(f.size)].filter(Boolean).join(' · ') }}</small></template>
      </Row>
    </div>

    <!-- Вікно запуску: мініатюра, підсумок і дві дії -->
    <div v-if="pick" class="shade" @click.self="pick = null">
      <div class="sheet">
        <div class="top">
          <div class="th">
            <img v-if="pick.thumb" :src="pick.thumb" alt="">
            <Icon v-else name="files" size="3rem" />
          </div>
          <div class="info">
            <b class="fn">{{ name(pick.path) }}</b>
            <small>{{ t('scr.printQ') }}</small>
            <dl v-if="pick.meta">
              <template v-if="pick.meta.estimated_time"><dt>{{ t('scr.est') }}</dt><dd>{{ fmtDuration(pick.meta.estimated_time, t) }}</dd></template>
              <template v-if="pick.meta.filament_type || pick.meta.filament_weight_total"><dt>{{ t('scr.fil') }}</dt><dd>{{ [pick.meta.filament_type, pick.meta.filament_weight_total && Math.round(pick.meta.filament_weight_total) + ' г'].filter(Boolean).join(' · ') }}</dd></template>
              <template v-if="pick.meta.layer_height"><dt>{{ t('scr.layerH') }}</dt><dd>{{ pick.meta.layer_height }} {{ t('tune.mm') }}</dd></template>
            </dl>
          </div>
        </div>
        <div class="acts">
          <button type="button" class="b alt tap" @click="pick = null">{{ t('common.cancel') }}</button>
          <button type="button" class="b main tap" :disabled="starting || p.active" @click="print">
            <Icon name="play" size="1.6rem" :stroke="2.4" />{{ t('scr.print') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sub{display:block;font-size:1.05rem;color:var(--dim);overflow:hidden;text-overflow:ellipsis}
.skel{display:grid}
.skel span{height:5.4rem;margin-left:1.2rem;box-shadow:inset 0 -1px 0 var(--group-sep)}
.skel span:last-child{box-shadow:none}
.note{margin:0 0 1rem}
/* Вікно поверх сторінки — суцільний фон, без розмиття (SPI-екран) */
.shade{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;padding:1rem}
.sheet{width:100%;border-radius:var(--r-lg);background:#1c1c1e;border:1px solid var(--card-edge);padding:1.2rem;display:grid;gap:1.2rem}
.top{display:flex;gap:1.2rem;min-height:0}
.th{flex:none;width:11rem;height:11rem;border-radius:var(--r);background:#000;display:grid;place-items:center;color:var(--dim);overflow:hidden}
.th img{width:100%;height:100%;object-fit:contain}
.info{flex:1;min-width:0;display:grid;align-content:start;gap:.3rem}
.fn{font-size:1.5rem;font-weight:700;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.info small{font-size:1.15rem;color:var(--dim)}
dl{margin:.5rem 0 0;display:grid;grid-template-columns:auto 1fr;gap:.25rem .9rem;font-size:1.2rem}
dt{color:var(--dim)}
dd{margin:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.acts{display:flex;gap:.8rem}
.b{flex:1;height:4.8rem;border-radius:var(--r);display:flex;align-items:center;justify-content:center;gap:.6rem;font-size:1.5rem;font-weight:600}
.b.alt{background:var(--btn);border:1px solid var(--btn-edge)}
.b.main{flex:1.4;background:var(--primary);color:var(--on-primary)}
</style>

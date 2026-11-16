<script setup>
// Файли G-code на принтері (новіші першими). Дотик до файлу — сторінка файлу (FilePage) з мініатюрою,
// часом друку, матеріалом і кнопкою «Друкувати».
// Під час друку новий файл не запустити (Klipper теж не дозволить).
import { ref } from 'vue'
import { usePrinter } from '../store'
import { t, lang } from '../i18n'
import { whenOnline } from '../online'
import Row from '../components/Row.vue'

const p = usePrinter()
const files = ref(null)          // null — ще вантажиться

whenOnline(async () => { try { files.value = await p.listFiles() } catch { files.value = [] } })

const name = path => path.replace(/^.*\//, '').replace(/\.(gcode|g|gco)$/i, '')
const folder = path => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
const size = b => (b > 1048576 ? (b / 1048576).toFixed(1) + ' ' + t('files.mb') : Math.round(b / 1024) + ' ' + t('files.kb'))
function when(sec) {
  const d = new Date(sec * 1000), now = new Date()
  if (d.toDateString() === now.toDateString()) return t('scr.today') + ' ' + d.toLocaleTimeString(lang.value, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString(lang.value, { day: 'numeric', month: 'short' })
}

function open(f) { p.selFile = f; p.go('file') }
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.files') }}</h1>
    <p v-if="p.active" class="note">{{ t('scr.filesBusy') }}</p>

    <div v-if="files === null" class="grp skel"><span v-for="i in 4" :key="i"></span></div>
    <p v-else-if="!files.length" class="grp-f">{{ t('files.empty') }}</p>
    <div v-else class="grp">
      <Row v-for="f in files" :key="f.path" icon="cube" :label="name(f.path)" chevron :disabled="p.active" @tap="open(f)">
        <template #sub><small class="sub">{{ [folder(f.path), when(f.modified), size(f.size)].filter(Boolean).join(' · ') }}</small></template>
      </Row>
    </div>

  </div>
</template>

<style scoped>
.sub{display:block;font-size:1.05rem;color:var(--dim);overflow:hidden;text-overflow:ellipsis}
.skel{display:grid}
.skel span{height:5.4rem;margin-left:1.2rem;box-shadow:inset 0 -1px 0 var(--group-sep)}
.skel span:last-child{box-shadow:none}
.note{margin:0 0 1rem}
</style>

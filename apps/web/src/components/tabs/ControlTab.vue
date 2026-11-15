<script setup>
// «Керування»: елементи поверх 3D-сцени. Ховаються, коли відкрита будь-яка інша панель.
import { usePrinterStore } from '../../stores/printerStore'
import { useI18n } from '../../composables/useI18n'
import StatusPanel from './control/StatusPanel.vue'
import JogControls from './control/JogControls.vue'
import ToolStrip from './control/ToolStrip.vue'
import RollNumber from '../ui/RollNumber.vue'
import MobileControl from './control/MobileControl.vue'
import { useMobile } from '../../composables/useMobile'

const printer = usePrinterStore()
const { t, tm } = useI18n()
/** Телефон / портрет до 900 px — окремий мобільний екран (MobileControl) */
const mobile = useMobile()
</script>

<template>
  <div class="control">
    <!-- 3D-перегляд файлу з історії: на сцені не поточний друк -->
    <div v-if="printer.preview" class="pv" role="status">
      <span class="pv-tag">3D</span>
      <span class="pv-name" :title="printer.preview.name">{{ printer.preview.name }}</span>
      <span v-if="printer.preview.loading" class="pv-dim">{{ t('preview.loading') }}</span>
      <span v-else-if="printer.preview.error" class="pv-err">{{ t('preview.error', { msg: printer.preview.error }) }}</span>
      <button @click="printer.closePreview()">{{ t('preview.close') }}</button>
    </div>
    <MobileControl v-if="mobile" />
    <template v-else>
      <StatusPanel />
      <JogControls />
      <div class="pct"><RollNumber :value="printer.progressPct" /><small>%</small></div>
      <div class="meta">{{ tm(printer.meta) }}</div>
      <ToolStrip />
    </template>
  </div>
</template>

<style scoped>
/* Розмір і ширина обмежені відстанню до центрованої смуги голів (~450px для 6 голів), щоб «100%»
   і довга назва файлу не заходили під неї. */
.pct{position:fixed;left:32px;bottom:55px;display:flex;align-items:baseline;font-size:clamp(70px,min(16vw,calc((50vw - 270px) / 2)),130px);font-weight:200;line-height:1;letter-spacing:-.04em;pointer-events:none;--rn-h:1.04em}
/* Анодований метал: вертикальний градієнт на кожній цифрі одометра (клітинка = своя «пластина») */
.pct :deep(.rn-strip>span){background:linear-gradient(180deg,#ffffff 0%,#eef0f3 34%,#b9bec6 72%,#8a9099 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
/* М'яке тепле світіння позаду (окремий шар, без дорогого filter на великому тексті) */
.pct::before{content:'';position:absolute;left:-18%;right:-30%;top:-10%;bottom:-25%;z-index:-1;border-radius:50%;
  background:radial-gradient(closest-side,rgba(var(--brand-rgb),.16),rgba(var(--brand-rgb),.05) 60%,transparent)}
.pct small{font-size:.3em;color:var(--brand);margin-left:5px;text-shadow:0 0 18px rgba(var(--brand-rgb),.6)}
.meta{position:fixed;left:36px;bottom:24px;color:var(--dim);font-size:12px;pointer-events:none;max-width:min(40vw,calc(50vw - 280px));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:900px){.pct{left:16px;bottom:24px;font-size:70px}.meta{display:none}}
@media(max-width:560px){.pct{bottom:12px;font-size:54px}}
.pv{position:fixed;top:calc(var(--hb,72px) + 12px);left:50%;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:10px;max-width:min(560px,calc(100vw - 32px));padding:6px 6px 6px 10px;background:rgba(10,10,11,.88);border:1px solid var(--line);border-radius:9px;backdrop-filter:blur(10px);font-size:12px}
.pv-tag{flex:none;font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--brand);border:1px solid rgba(var(--brand-rgb),.6);border-radius:4px;padding:1px 5px}
.pv-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.pv-dim{color:var(--dim);white-space:nowrap}
.pv-err{color:var(--red);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.pv button{flex:none;background:rgba(10,10,11,.5);border:1px solid var(--line);color:var(--ink);font:inherit;font-size:12px;border-radius:7px;padding:6px 10px;cursor:pointer}
.pv button:hover{border-color:var(--brand)}
@media(max-width:700px){.pv{top:calc(var(--hb,72px) + 6px)}}
</style>

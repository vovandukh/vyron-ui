<script setup>
// Панель телеметрії. Рядок з'являється лише тоді, коли відповідна функція є в конфігурації Klipper
// і від неї вже прийшли дані — жодних прочерків. Поява/зникнення рядків анімовані.
// Сопло, стіл, швидкість і обдув відкривають поповер швидкого керування (QuickSlider).
import { ref, computed, watch } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useUiStore } from '../../../stores/uiStore'
import { useI18n } from '../../../composables/useI18n'
import { heatRgb } from '@vyron/shared/format'
import RollNumber from '../../ui/RollNumber.vue'
import QuickSlider from './QuickSlider.vue'
import PrintControls from './PrintControls.vue'
import ToolPopover from './ToolPopover.vue'

const printer = usePrinterStore()
const ui = useUiStore()
const { t } = useI18n()

/** Шар показуємо під час друку/паузи і після завершення (фінальне «150 / 150»), у режимі очікування — ні. */
const LAYER_STATES = ['printing', 'paused', 'complete']

const rows = computed(() => {
  const p = printer, out = []
  const num = (id, label, value, o = {}) => { if (value != null && Number.isFinite(value)) out.push({ id, label, value, ...o }) }
  // Одна голова: сопло показує картка голови під панеллю (як на телефоні) — рядок був би дублем
  if (p.toolObjects.length > 1) num('nozzle', t('status.nozzle'), p.nozzleTemp, { suffix: '°', quick: true, heat: p.nozzleTemp })
  if (p.hasBed) num('bed', t('status.bed'), p.bedTemp, { suffix: '°', quick: true, heat: p.bedTemp, heatRange: [30, 100] })
  if (p.chamberObj) num('chamber', t('status.chamber'), p.chamberTemp, { suffix: '°' })
  num('speed', t('status.speed'), p.speedFactor == null ? null : p.speedFactor * 100, { suffix: '%', quick: true })
  if (p.hasFan) num('fan', t('status.fan'), p.fanSpeed == null ? null : p.fanSpeed * 100, { suffix: '%', quick: true })
  if (p.position) num('z', t('status.z'), Number(p.position[2]), { decimals: 1, suffix: mmSuffix.value })
  if (LAYER_STATES.includes(p.printState) && p.layerText && p.layerText !== '–') {
    const m = /^(\d+)\s*\/\s*(.+)$/.exec(p.layerText)
    out.push(m ? { id: 'layer', label: t('status.layer'), value: +m[1], suffix: ' / ' + m[2] } : { id: 'layer', label: t('status.layer'), text: p.layerText })
  }
  if (p.leveling && p.qgl != null) {
    out.push({ id: 'level', label: t(p.leveling.kind === 'ztilt' ? 'status.ztilt' : 'status.qgl'), text: t(p.qgl ? 'status.qglDone' : 'status.qglNot'), ok: p.qgl })
  }
  return out
})
// Одиниця «мм» з локалі ('{v} мм' → ' мм')
const mmSuffix = computed(() => t('unit.mm', { v: '' }))

// Колір підсвічування гарячих значень (сопло — 35…180°, стіл — 30…100°)
const glow = r => (r.heat == null ? null : { '--heat': heatRgb(r.heat, ...(r.heatRange || [])) })

// ---------- швидкі слайдери: одночасно відкритий лише один ----------
const panel = ref(null)
const rowEls = {}
const open = ref(null)
const toggle = id => { open.value = open.value === id ? null : id }
// Рядок зник (немає даних / відключення) або вкладка змінилась — закриваємо його слайдер.
watch(() => rows.value.some(r => r.id === open.value), has => { if (!has) open.value = null })
watch(() => ui.view, v => { if (v !== 'main') open.value = null })
watch(() => ui.homeTick, () => { open.value = null })   // клік по логотипу закриває все
</script>

<template>
  <!-- Права колонка: панель даних і (для однієї голови) картка голови під нею -->
  <div class="rcol">
  <Transition name="pn">
    <div v-if="rows.length" ref="panel" class="st glass">
      <TransitionGroup tag="dl" name="rw" class="dl">
        <div v-for="r in rows" :key="r.id" :ref="el => { if (el) rowEls[r.id] = el }" class="rw"
             :class="{ q: r.quick, on: open === r.id, hot: r.heat != null }" :style="glow(r)"
             v-bind="r.quick ? { role: 'button', tabindex: 0, 'aria-haspopup': 'dialog', 'aria-expanded': String(open === r.id) } : {}"
             @click="r.quick && toggle(r.id)" @keydown.enter.space.prevent="r.quick && toggle(r.id)">
          <dt>{{ r.label }}</dt>
          <dd :class="{ ok: r.ok === true, warn: r.ok === false }">
            <RollNumber v-if="r.value != null" :value="r.value" :decimals="r.decimals || 0" :suffix="r.suffix" />
            <template v-else>{{ r.text }}</template>
          </dd>
        </div>
      </TransitionGroup>
      <!-- Керування друком: лише під час друку / паузи (не під час 3D-перегляду іншого файлу) -->
      <Transition name="pcx">
        <PrintControls v-if="printer.printBusy && !printer.preview" />
      </Transition>
    </div>
  </Transition>
  <!-- Обгортка: у ToolPopover кілька кореневих вузлів, тож клас на самому компоненті не застосовується —
       а без pointer-events:auto картка успадковує none від колонки й не клікається -->
  <div v-if="printer.toolCount === 1" class="head"><ToolPopover :name="printer.toolObjects[0]" :index="0" inline /></div>
  </div>
  <Transition name="qs">
    <QuickSlider v-if="open && rowEls[open]" :key="open" :kind="open" :anchor="rowEls[open]" :panel="panel" @close="open = null" />
  </Transition>
</template>

<style scoped>
/* Права колонка: якщо картка голови не вміщається по висоті — колонка гортається сама, решта екрана не зачіпається */
.rcol{position:fixed;top:calc(var(--hb,72px) + 16px);right:36px;bottom:16px;width:min(268px,40vw);display:flex;flex-direction:column;gap:10px;z-index:3;
  overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;pointer-events:none}
.rcol::-webkit-scrollbar{display:none}
/* Низ колонки плавно згасає — видно, що картку голови можна догорнути (на 1024×600 / 800×480) */
.rcol{-webkit-mask-image:linear-gradient(#000 calc(100% - 22px),transparent);mask-image:linear-gradient(#000 calc(100% - 22px),transparent);padding-bottom:18px}
.rcol>*{flex-shrink:0}
.st{position:relative;margin:0;padding:6px 10px;text-align:left;pointer-events:none;border-radius:var(--r-lg)}
.head{pointer-events:auto;border-radius:var(--r-lg)}
/* Картка голови вужча, ніж на телефоні: компактні поля й кнопки */
.head :deep(.body){padding:12px;gap:8px}
.head :deep(.temp){font-size:24px}
.head :deep(button),.head :deep(input){padding:7px 9px;font-size:12px}
.head :deep(.pre button){padding:5px 0}
.dl{display:grid;margin:0}
.rw{position:relative;display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 8px;border-radius:var(--r);max-height:60px;
  transition:background-color var(--t-fast) var(--ease-out),transform var(--t-spring) var(--spring)}
/* Розділювач між рядками — псевдоелемент, щоб не стрибав під час анімації висоти */
.rw+.rw::before{content:'';position:absolute;left:8px;right:8px;top:0;height:1px;background:rgba(255,255,255,.06)}
dt{font-size:12px;color:var(--dim);white-space:nowrap}
dd{margin:0;font-size:16px;font-weight:300;white-space:nowrap}
dd.ok{color:#8fe3a8}
dd.warn{color:#ffb35c}

/* Інтерактивні рядки: м'яке підсвічування, натискання пружне */
.rw.q{pointer-events:auto;cursor:pointer}
.rw.q:hover{background:rgba(255,255,255,.05)}
.rw.q:active{transform:scale(.97)}
.rw.q.on{background:rgba(255,255,255,.08)}
.rw.q.on::after{content:'';position:absolute;left:0;top:50%;width:3px;height:16px;margin-top:-8px;border-radius:2px;background:var(--coral)}
.rw.q:focus-visible{outline:2px solid var(--coral);outline-offset:-2px}
/* Гарячі значення світяться теплим кольором (крижаний → кораловий) */
.rw.hot dd{color:rgb(var(--heat));color:color-mix(in srgb,rgb(var(--heat)) 55%,var(--ink));text-shadow:0 0 16px rgba(var(--heat),.5);transition:color 1s var(--ease-out),text-shadow 1s var(--ease-out)}

/* Поява/зникнення рядків: висота + прозорість */
.rw-enter-active,.rw-leave-active{transition:max-height var(--t-mid) var(--ease-out),opacity var(--t-mid) var(--ease-out),padding var(--t-mid) var(--ease-out);overflow:hidden}
.rw-enter-from,.rw-leave-to{max-height:0;opacity:0;padding-top:0;padding-bottom:0}
.pn-enter-active,.pn-leave-active{transition:opacity var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.pn-enter-from,.pn-leave-to{opacity:0;transform:translateY(-6px) scale(.98)}

/* Блок керування друком — під тонким розділювачем; з'являється/зникає зміною висоти */
.st .pc{border-top:1px solid rgba(255,255,255,.06);margin-top:2px;max-height:120px}
.pcx-enter-active,.pcx-leave-active{transition:max-height var(--t-spring) var(--spring),opacity var(--t-mid) var(--ease-out),padding var(--t-mid) var(--ease-out);overflow:hidden}
.pcx-enter-from,.pcx-leave-to{max-height:0;opacity:0;padding-top:0;padding-bottom:0}

/* Поповер слайдера: пружне масштабування від рядка */
.qs-enter-active{transition:transform var(--t-spring) var(--spring),opacity var(--t-fast) var(--ease-out)}
.qs-leave-active{transition:transform .16s var(--ease-out),opacity .14s var(--ease-out)}
.qs-enter-from{opacity:0;transform:scale(.8)}
.qs-leave-to{opacity:0;transform:scale(.94)}

@media(max-width:700px){.rcol{top:auto;bottom:140px;right:14px;width:min(268px,62vw)}}
/* Низькі екрани (800×480): компактні рядки, щоб блок не заходив під смугу голів */
@media(max-height:540px){.st{padding:4px 8px}.rw{padding:5px 8px}dd{font-size:14px}dt{font-size:11px}}
</style>

<script setup>
// Смуга голів: рівно стільки кнопок, скільки екструдерів знайдено в Klipper (1…N).
// Клік по голові відкриває/закриває її випадаюче меню (ToolPopover).
// Кожна картка світиться за температурою (крижаний ≤35° → кораловий ≥180°); активна піднята,
// а фон вибору — одна спільна підсвітка, що пружно перетікає між картками при зміні інструмента.
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useUiStore } from '../../../stores/uiStore'
import { toolNum } from '../../../services/klipper'
import { heatRgb } from '../../../utils/format'
import ToolPopover from './ToolPopover.vue'

const printer = usePrinterStore()
const ui = useUiStore()

const tempOf = name => (printer.st[name] || {}).temperature
const temp = name => {
  const v = tempOf(name)
  return v == null ? '—' : Math.round(v) + '°'
}
const heat = name => ({ '--heat': heatRgb(tempOf(name)) })

/** Відкрите меню: { name, index, anchor } або null. */
const open = ref(null)
const btns = {}

function toggle(name, index) {
  open.value = open.value && open.value.name === name ? null : { name, index, anchor: btns[name] }
}
const close = () => { open.value = null }

// Меню закривається, коли смуга зникає: інша вкладка, голова пропала з конфігу, перепідключення.
watch(() => ui.view, v => { if (v !== 'main') close() })
watch(() => ui.homeTick, close)   // клік по логотипу закриває все
watch(() => printer.toolObjects, list => { if (open.value && !list.includes(open.value.name)) close() })

// ---------- спільна підсвітка вибору ----------
const sel = ref({ x: 0, w: 0, on: false })
const instant = ref(true)
function place() {
  const b = btns[printer.activeToolName]
  sel.value = b ? { x: b.offsetLeft, w: b.offsetWidth, on: true } : { ...sel.value, on: false }
}
watch(() => printer.activeToolName, () => nextTick(place))
watch(() => printer.toolObjects.length, () => { instant.value = true; nextTick(() => { place(); requestAnimationFrame(() => { instant.value = false }) }) })
onMounted(() => {
  nextTick(place)
  requestAnimationFrame(() => requestAnimationFrame(() => { instant.value = false }))
  addEventListener('resize', place)
})
onBeforeUnmount(() => removeEventListener('resize', place))
</script>

<template>
  <div v-if="printer.toolObjects.length" class="tools glass">
    <span class="sel" :class="{ on: sel.on, instant }" :style="{ ...heat(printer.activeToolName), transform: `translateX(${sel.x}px) scale(1.03)`, width: sel.w + 'px' }" aria-hidden="true"></span>
    <button v-for="(name, i) in printer.toolObjects" :key="name" :ref="el => { if (el) btns[name] = el }" class="tool"
            :class="{ active: name === printer.activeToolName, open: open && open.name === name }" :style="heat(name)"
            :title="name" aria-haspopup="dialog" :aria-expanded="String(!!(open && open.name === name))"
            @click="toggle(name, i)">
      <b>T{{ toolNum(name) }}</b><small>{{ temp(name) }}</small>
    </button>
  </div>
  <ToolPopover v-if="open" :key="open.name" :name="open.name" :index="open.index" :anchor="open.anchor" @close="close" />
</template>

<style scoped>
.tools{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;display:flex;gap:6px;z-index:4;padding:7px;max-width:94vw;overflow-x:auto;border-radius:18px;scrollbar-width:none}
.tools::-webkit-scrollbar{display:none}
.tool{position:relative;z-index:1;flex:none;min-width:66px;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--dim);padding:7px 9px;cursor:pointer;font:inherit;text-align:center;
  transition:transform var(--t-spring) var(--spring),border-color var(--t-mid) var(--ease-out),background-color var(--t-fast) var(--ease-out)}
.tool:hover{background:rgba(255,255,255,.04)}
.tool:active{transform:scale(.95)}
.tool b{display:block;color:var(--ink);font-size:12px;font-weight:500}
/* Температура кожної голови тонована її теплом; нижня риска світиться сильніше, що гарячіша голова */
.tool small{display:block;margin-top:3px;font-size:10px;color:rgb(var(--heat));color:color-mix(in srgb,rgb(var(--heat)) 70%,var(--dim));transition:color 1s var(--ease-out)}
.tool::after{content:'';position:absolute;left:50%;bottom:3px;width:14px;height:2px;margin-left:-7px;border-radius:2px;background:rgb(var(--heat));opacity:.35;transition:background-color 1s var(--ease-out),opacity var(--t-mid) var(--ease-out)}
.tool.active{transform:scale(1.03)}
.tool.active:active{transform:scale(.98)}
.tool.active small{color:rgb(var(--heat))}
.tool.active::after{opacity:.9;box-shadow:0 0 8px rgba(var(--heat),.9)}
/* Голова з відкритим меню */
.tool.open{border-color:rgba(255,255,255,.5)}
.tool:focus-visible{outline:2px solid var(--coral);outline-offset:2px}

/* Спільна підсвітка вибору: перетікає між картками пружиною, колір — тепло активної голови */
.sel{position:absolute;left:0;top:7px;bottom:7px;border-radius:12px;opacity:0;pointer-events:none;transform-origin:center;
  background:linear-gradient(180deg,rgba(var(--heat),.2),rgba(var(--heat),.08));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 1px rgba(var(--heat),.55),0 8px 24px -8px rgba(var(--heat),.7);
  transition:transform var(--t-spring) var(--spring),width var(--t-spring) var(--spring),opacity var(--t-mid) var(--ease-out),background 1s var(--ease-out),box-shadow 1s var(--ease-out)}
.sel.on{opacity:1}
.sel.instant{transition:none}

/* Смугу піднімаємо лише на вузьких екранах, де вона інакше зайшла б на великий «100%» ліворуч. */
@media(max-width:700px){.tools{bottom:62px}}
@media(max-width:900px){.tool{min-width:52px;padding:6px}}
</style>

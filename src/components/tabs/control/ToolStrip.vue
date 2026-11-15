<script setup>
// Смуга голів: рівно стільки кнопок, скільки екструдерів знайдено в Klipper (1…N).
// Клік по голові відкриває/закриває її випадаюче меню (ToolPopover).
// Кожна «пігулка» тонована теплом своєї голови (крижаний ≤35° → кораловий ≥180°), активна — з обводом і світінням.
import { ref, watch } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useUiStore } from '../../../stores/uiStore'
import { toolNum } from '../../../services/klipper'
import { heatRgb } from '../../../utils/format'
import ToolPopover from './ToolPopover.vue'

/** Мобільна розкладка: «пігулки» сіткою по 3 без скролу, меню голови розгортається під ними в потоці (а не поверх) */
const props = defineProps({ inline: { type: Boolean, default: false } })

const printer = usePrinterStore()
const ui = useUiStore()
const cols = () => Math.min(3, printer.toolObjects.length)
/** Після розгортання — догорнути стовпчик так, щоб картка голови була видна цілком */
const accEl = ref(null)
function reveal() { accEl.value?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) }

const tempOf = name => (printer.st[name] || {}).temperature
const temp = name => {
  const v = tempOf(name)
  return v == null ? '—' : Math.round(v) + '°'
}
const heat = name => ({ '--heat': heatRgb(tempOf(name)) })
/** Плата голови (EBBCan, SB2209…) — лише коли голів до трьох; основну плату не показуємо */
const board = name => {
  // У мобільній сітці з трьох колонок назва плати не вміщається
  if (printer.toolObjects.length > 3 || (props.inline && printer.toolObjects.length === 3)) return ''
  const th = printer.toolheads[name]
  return th && th.mcu && th.mcu !== 'mcu' ? th.mcu : ''
}

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

</script>

<template>
  <!-- Кілька голів — ряд скляних «пігулок»: ● T0 205° | EBBCan ⌄ (плата — коли голів до трьох, інакше ряд не вміщається).
       Одна голова — без смуги: її картка стоїть під панеллю даних (StatusPanel / MobileControl). -->
  <div v-if="printer.toolObjects.length > 1" class="tools" :class="{ many: printer.toolObjects.length > 3, inl: inline }"
       :style="inline ? { gridTemplateColumns: `repeat(${cols()}, minmax(0, 1fr))` } : null">
    <button v-for="(name, i) in printer.toolObjects" :key="name" :ref="el => { if (el) btns[name] = el }" type="button" class="pill glass"
            :class="{ active: name === printer.activeToolName, open: open && open.name === name }" :style="heat(name)"
            :title="name" aria-haspopup="dialog" :aria-expanded="String(!!(open && open.name === name))"
            @click="toggle(name, i)">
      <i class="hd" aria-hidden="true"></i>
      <b>T{{ toolNum(name) }}</b>
      <span class="tp">{{ temp(name) }}</span>
      <span v-if="board(name)" class="bd">{{ board(name) }}</span>
      <svg class="cv" viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></svg>
    </button>
  </div>
  <ToolPopover v-if="open && !inline" :key="open.name" :name="open.name" :index="open.index" :anchor="open.anchor" @close="close" />
  <!-- Мобільна: акордеон — картка голови плавно розсуває вміст під «пігулками» -->
  <Transition v-if="inline" name="acc" @after-enter="reveal">
    <div v-if="open" ref="accEl" class="acc">
      <div class="acc-in">
        <Transition name="accx" mode="out-in">
          <ToolPopover :key="open.name" :name="open.name" :index="open.index" inline />
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Ряд «пігулок» голів по центру над низом екрана; якщо не вміщається — гортається вбік */
.tools{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;display:flex;gap:8px;z-index:4;padding:6px;max-width:94vw;overflow-x:auto;scrollbar-width:none}
.tools::-webkit-scrollbar{display:none}
.pill{flex:none;display:flex;align-items:center;gap:8px;height:40px;padding:0 12px 0 11px;border-radius:999px;font:inherit;font-size:12.5px;color:var(--ink);cursor:pointer;
  transition:transform var(--t-spring) var(--spring),border-color var(--t-mid) var(--ease-out),box-shadow 1s var(--ease-out),background-color var(--t-fast) var(--ease-out)}
.pill:hover{background-color:rgba(40,40,44,.75)}
.pill:active{transform:scale(.96)}
/* Активна голова: тонкий обвід і світіння в кольорі її тепла */
.pill.active{border-color:rgba(var(--heat),.55);box-shadow:0 0 0 1px rgba(var(--heat),.25),0 8px 22px -8px rgba(var(--heat),.7),var(--glass-shadow)}
.pill.open{border-color:rgba(255,255,255,.45)}
.hd{width:8px;height:8px;border-radius:50%;background:rgb(var(--heat));opacity:.55;transition:background-color 1s var(--ease-out),opacity var(--t-mid) var(--ease-out)}
.active .hd{opacity:1;box-shadow:0 0 8px rgba(var(--heat),.9)}
.pill b{font-weight:600}
.tp{color:rgb(var(--heat));color:color-mix(in srgb,rgb(var(--heat)) 75%,var(--dim));transition:color 1s var(--ease-out)}
.active .tp{color:rgb(var(--heat))}
.bd{padding-left:8px;border-left:1px solid rgba(255,255,255,.12);color:var(--dim)}
.cv{width:13px;height:13px;fill:none;stroke:var(--dim);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;transition:transform var(--t-spring) var(--spring)}
.open .cv{transform:rotate(180deg)}
.pill:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
/* Багато голів: компактніше, без шеврона */
.many .pill{gap:6px;padding:0 11px 0 10px}
.many .cv{display:none}
@media(max-width:900px){.pill{height:36px;font-size:12px;gap:6px;padding:0 10px}}
/* ---------- мобільна сітка: по 3 в ряд, без скролу ---------- */
.tools.inl{position:relative;left:auto;bottom:auto;transform:none;max-width:none;width:100%;display:grid;gap:8px;padding:2px 0;overflow:visible}
.inl .pill{width:100%;min-width:0;justify-content:center;height:40px;padding:0 8px}
.inl .bd{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.inl.many .cv,.inl .cv{display:block}
/* Вузький телефон: у половині ширини назва плати лише обрізалась би до «EBB…» */
@media(max-width:420px){.inl .bd{display:none}}
/* Акордеон: висота 0fr → 1fr (grid-трюк), вміст плавно проявляється */
.acc{display:grid;grid-template-rows:1fr;margin-top:8px}
.acc-in{min-height:0;overflow:hidden}
.acc-enter-active,.acc-leave-active{transition:grid-template-rows var(--t-spring) var(--spring),margin-top var(--t-spring) var(--spring),opacity var(--t-mid) var(--ease-out)}
.acc-enter-from,.acc-leave-to{grid-template-rows:0fr;margin-top:0;opacity:0}
/* Перемикання між головами всередині відкритого акордеону */
.accx-enter-active,.accx-leave-active{transition:opacity .16s var(--ease-out)}
.accx-enter-from,.accx-leave-to{opacity:0}

/* Смугу піднімаємо лише на вузьких екранах, де вона інакше зайшла б на великий «100%» ліворуч. */
@media(max-width:700px){.tools:not(.inl){bottom:62px}}
</style>

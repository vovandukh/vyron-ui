<script setup>
// Смуга голів: рівно стільки кнопок, скільки екструдерів знайдено в Klipper (1…N).
// Клік по голові відкриває/закриває її випадаюче меню (ToolPopover).
import { ref, watch } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useUiStore } from '../../../stores/uiStore'
import { toolNum } from '../../../services/klipper'
import ToolPopover from './ToolPopover.vue'

const printer = usePrinterStore()
const ui = useUiStore()

const temp = name => {
  const v = (printer.st[name] || {}).temperature
  return v == null ? '—' : Math.round(v) + '°'
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
watch(() => printer.toolObjects, list => { if (open.value && !list.includes(open.value.name)) close() })
</script>

<template>
  <div v-if="printer.toolObjects.length" class="tools">
    <button v-for="(name, i) in printer.toolObjects" :key="name" :ref="el => { if (el) btns[name] = el }" class="tool"
            :class="{ active: name === printer.activeToolName, open: open && open.name === name }"
            :title="name" aria-haspopup="dialog" :aria-expanded="String(!!(open && open.name === name))"
            @click="toggle(name, i)">
      <b>T{{ toolNum(name) }}</b><small>{{ temp(name) }}</small>
    </button>
  </div>
  <ToolPopover v-if="open" :key="open.name" :name="open.name" :index="open.index" :anchor="open.anchor" @close="close" />
</template>

<style scoped>
.tools{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;display:flex;gap:7px;z-index:4;padding:7px;max-width:94vw;overflow-x:auto;background:rgba(10,10,11,.88);border:1px solid var(--line);border-radius:10px;backdrop-filter:blur(12px)}
.tool{flex:none;min-width:66px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--dim);padding:7px 9px;cursor:pointer;font:inherit;text-align:center}
.tool:hover{border-color:var(--line)}
.tool b{display:block;color:var(--ink);font-size:12px;font-weight:500}
.tool small{display:block;margin-top:3px;font-size:10px}
.tool.active{border-color:rgba(240,58,46,.7);background:rgba(240,58,46,.10);color:var(--red)}
.tool.active b{color:var(--ink)}
/* Голова з відкритим меню */
.tool.open{box-shadow:inset 0 0 0 1px var(--ink)}
.tool:focus-visible{outline:2px solid var(--red);outline-offset:2px}
/* ≤1100px (екран принтера 1024×600) смуга і рядок підключення не вміщаються в один ряд — піднімаємо смугу */
@media(max-width:1100px){.tools{bottom:62px}}
@media(max-width:900px){.tool{min-width:52px;padding:6px}}
</style>

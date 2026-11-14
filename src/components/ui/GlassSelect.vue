<script setup>
// Випадаючий список у стилі інтерфейсу замість нативного <select> (його список опцій малює ОС —
// на Windows це білий системний список, який CSS не стилізує).
// Кнопка-капсула з шевроном → скляна панель, що пружно виростає від кнопки; вибраний пункт з галочкою.
// Клавіатура як у нативного: ↑/↓, Home/End, Enter/Space, Esc, Tab, набір першої літери.
// Панель телепортується в body — панель вкладки з overflow:auto її не обрізає.
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  /** [{ value, label, hint? }] */
  options: { type: Array, required: true },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const uid = 'gs' + Math.random().toString(36).slice(2, 8)
const btn = ref(null), list = ref(null)
const open = ref(false)
const hi = ref(0)                 // підсвічений (клавіатурою/наведенням) пункт
const pos = ref({ left: 0, top: 0, width: 0, up: false })

const current = computed(() => props.options.find(o => o.value === props.modelValue) || null)
const selIndex = () => Math.max(0, props.options.findIndex(o => o.value === props.modelValue))

function place() {
  const r = btn.value.getBoundingClientRect()
  const h = list.value ? list.value.offsetHeight : props.options.length * 44 + 12
  const below = innerHeight - r.bottom - 8, above = r.top - 8
  const up = below < h + 6 && above > below
  const width = Math.max(r.width, 180)
  pos.value = {
    left: Math.min(innerWidth - width - 8, Math.max(8, r.right - width)),
    top: up ? r.top - 6 - h : r.bottom + 6,
    width, up
  }
}

function show() {
  if (open.value) return
  hi.value = selIndex()
  open.value = true
  place()
  nextTick(() => { place(); list.value?.focus({ preventScroll: true }) })
  addEventListener('resize', hide)
  addEventListener('scroll', onScroll, true)
  document.addEventListener('pointerdown', onDoc, true)
}
function hide(refocus = false) {
  if (!open.value) return
  open.value = false
  removeEventListener('resize', hide)
  removeEventListener('scroll', onScroll, true)
  document.removeEventListener('pointerdown', onDoc, true)
  if (refocus === true) btn.value?.focus()
}
const toggle = () => (open.value ? hide(true) : show())
const onDoc = e => { if (!btn.value?.contains(e.target) && !list.value?.contains(e.target)) hide() }
const onScroll = e => { if (!list.value?.contains(e.target)) hide() }

function pick(i) {
  const o = props.options[i]
  if (o && o.value !== props.modelValue) emit('update:modelValue', o.value)
  hide(true)
}

function onBtnKey(e) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
}
function onListKey(e) {
  const n = props.options.length
  switch (e.key) {
    case 'ArrowDown': hi.value = (hi.value + 1) % n; break
    case 'ArrowUp': hi.value = (hi.value - 1 + n) % n; break
    case 'Home': hi.value = 0; break
    case 'End': hi.value = n - 1; break
    case 'Enter': case ' ': pick(hi.value); break
    case 'Escape': hide(true); break
    case 'Tab': hide(); return
    default: {
      // Набір першої літери — перехід до пункту, що з неї починається
      if (e.key.length !== 1) return
      const k = e.key.toLowerCase()
      const j = props.options.findIndex((o, i) => i > hi.value && String(o.label).toLowerCase().startsWith(k))
      const f = j >= 0 ? j : props.options.findIndex(o => String(o.label).toLowerCase().startsWith(k))
      if (f >= 0) hi.value = f
      else return
    }
  }
  e.preventDefault()
}

onBeforeUnmount(() => hide())
</script>

<template>
  <button ref="btn" type="button" class="gs" :class="{ open }" role="combobox" aria-haspopup="listbox"
          :aria-expanded="String(open)" :aria-controls="uid" :aria-label="ariaLabel || undefined"
          @click="toggle" @keydown="onBtnKey">
    <span class="gs-val">{{ current ? current.label : '—' }}</span>
    <svg class="gs-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
  </button>
  <Teleport to="body">
    <Transition name="gsl">
      <ul v-if="open" :id="uid" ref="list" class="gsl" :class="{ up: pos.up }" role="listbox" tabindex="-1"
          :aria-label="ariaLabel || undefined" :aria-activedescendant="uid + '-' + hi"
          :style="{ left: pos.left + 'px', top: pos.top + 'px', width: pos.width + 'px' }" @keydown="onListKey">
        <li v-for="(o, i) in options" :id="uid + '-' + i" :key="o.value" role="option" :aria-selected="String(o.value === modelValue)"
            :class="{ hi: i === hi, sel: o.value === modelValue }" @pointerenter="hi = i" @click="pick(i)">
          <svg class="ck" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" /></svg>
          <span class="lb">{{ o.label }}</span>
          <small v-if="o.hint">{{ o.hint }}</small>
        </li>
      </ul>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Кнопка: та сама капсула, що й поля вводу, шеврон обертається при відкритті */
.gs{display:inline-flex;align-items:center;justify-content:space-between;gap:10px;min-width:140px;padding:9px 12px 9px 14px;
  background:var(--field-bg);border:1px solid var(--field-bd);border-radius:var(--r);color:var(--ink);font:inherit;font-size:13px;cursor:pointer;
  transition:border-color var(--t-fast) var(--ease-out),box-shadow var(--t-fast) var(--ease-out),transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out)}
.gs:hover{background-color:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14)}
.gs:active{transform:scale(.97)}
.gs.open,.gs:focus-visible{outline:none;border-color:rgba(255,107,90,.7);box-shadow:var(--ring)}
.gs-val{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gs-chev{flex:none;width:12px;height:12px;fill:none;stroke:var(--dim);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;transition:transform var(--t-spring) var(--spring),stroke var(--t-fast) var(--ease-out)}
.gs.open .gs-chev{transform:rotate(180deg);stroke:var(--coral)}
</style>

<style>
/* Панель списку — поза scoped: вона телепортована в body */
.gsl{position:fixed;z-index:40;margin:0;padding:6px;list-style:none;display:grid;gap:2px;max-height:min(320px,70vh);overflow:auto;outline:none;
  background:rgba(24,24,27,.86);-webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);
  border:1px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);border-radius:var(--r-md);
  box-shadow:0 24px 48px -16px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.05);transform-origin:top center;font-size:13px;color:var(--ink)}
.gsl.up{transform-origin:bottom center}
.gsl li{position:relative;display:flex;align-items:center;gap:10px;padding:10px 12px 10px 34px;border-radius:9px;cursor:pointer;user-select:none;
  transition:background-color var(--t-fast) var(--ease-out)}
.gsl li.hi{background:rgba(255,255,255,.08)}
.gsl li:active{background:rgba(255,107,90,.16)}
.gsl li .lb{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gsl li small{color:var(--dim);font-size:11px;letter-spacing:.04em}
.gsl li .ck{position:absolute;left:11px;top:50%;width:15px;height:15px;margin-top:-7.5px;fill:none;stroke:var(--coral);stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;opacity:0;transform:scale(.6);
  transition:opacity var(--t-fast) var(--ease-out),transform var(--t-spring) var(--spring)}
.gsl li.sel .ck{opacity:1;transform:scale(1)}
.gsl li.sel .lb{font-weight:600}
/* Поява: пружне масштабування від кнопки */
.gsl-enter-active{transition:transform var(--t-spring) var(--spring),opacity var(--t-fast) var(--ease-out)}
.gsl-leave-active{transition:transform .14s var(--ease-out),opacity .12s var(--ease-out)}
.gsl-enter-from{opacity:0;transform:scale(.92) translateY(-4px)}
.gsl.up.gsl-enter-from{transform:scale(.92) translateY(4px)}
.gsl-leave-to{opacity:0;transform:scale(.97)}
</style>

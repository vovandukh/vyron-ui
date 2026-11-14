<script setup>
// Сегментний перемикач у стилі iOS/macOS: скляна капсула, індикатор перетікає між сегментами пружиною.
// Клавіатура: ←/→ (role=tablist).
import { ref, watch, nextTick, onMounted, onBeforeUnmount, onActivated } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  /** [{ value, label }] */
  options: { type: Array, required: true },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const root = ref(null)
const btns = {}
const ind = ref({ x: 0, w: 0 })
const instant = ref(true)

function place() {
  const b = btns[props.modelValue]
  if (b && b.offsetWidth) ind.value = { x: b.offsetLeft, w: b.offsetWidth }
}
function select(v) { if (v !== props.modelValue) emit('update:modelValue', v) }
function onKey(e) {
  const i = props.options.findIndex(o => o.value === props.modelValue), n = props.options.length
  const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : -1
  if (j < 0) return
  e.preventDefault()
  select(props.options[j].value)
  nextTick(() => btns[props.options[j].value]?.focus())
}

watch(() => props.modelValue, () => nextTick(place))
let ro = null
onMounted(() => {
  place()
  requestAnimationFrame(() => requestAnimationFrame(() => { instant.value = false }))
  if (window.ResizeObserver) { ro = new ResizeObserver(place); ro.observe(root.value) }
  document.fonts?.ready?.then(place)
})
// Панель у KeepAlive: при поверненні розміри могли змінитись (мова, вікно)
onActivated(() => nextTick(place))
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div ref="root" class="seg" role="tablist" :aria-label="ariaLabel || undefined" @keydown="onKey">
    <span class="ind" :class="{ instant }" :style="{ transform: `translateX(${ind.x}px)`, width: ind.w + 'px' }" aria-hidden="true"></span>
    <button v-for="o in options" :key="o.value" :ref="el => { if (el) btns[o.value] = el }" type="button" role="tab"
            :aria-selected="String(o.value === modelValue)" :tabindex="o.value === modelValue ? 0 : -1"
            :class="{ on: o.value === modelValue }" @click="select(o.value)">{{ o.label }}</button>
  </div>
</template>

<style scoped>
.seg{position:relative;display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:rgba(0,0,0,.3);border:1px solid var(--hair);box-shadow:inset 0 1px 2px rgba(0,0,0,.35);max-width:100%;align-self:flex-start}
/* .seg button — щоб перебити загальні стилі .view button */
.seg button{position:relative;z-index:1;flex:1 1 auto;min-width:0;padding:8px 18px;border:0;border-radius:999px;background:transparent;color:var(--dim);font:inherit;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;
  transition:color var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.seg button:hover:not(.on){color:var(--ink);background:transparent;border:0}
.seg button.on{color:var(--ink)}
.seg button:active{transform:scale(.96)}
.seg button:focus-visible{outline:2px solid var(--coral);outline-offset:-2px}
.ind{position:absolute;left:0;top:3px;bottom:3px;border-radius:999px;pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.07));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 0 0 1px rgba(255,255,255,.05),0 6px 16px -8px rgba(240,58,46,.7);
  transition:transform var(--t-spring) var(--spring),width var(--t-spring) var(--spring)}
.ind.instant{transition:none}
@media(max-width:560px){.seg button{padding:7px 12px;font-size:11px}}
</style>

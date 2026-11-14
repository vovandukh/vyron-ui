<script setup>
// Числове поле-капсула «− значення +» замість <input type=number> з нативними стрілками.
// Під тачскрін: утримання −/+ повторює крок, з прискоренням. Значення можна й ввести вручну:
// застосовується по Enter / при втраті фокусу; невалідне повертається до попереднього.
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: Number, required: true },
  step: { type: Number, default: 1 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: Infinity },
  unit: { type: String, default: '' },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const text = ref(String(props.modelValue))
watch(() => props.modelValue, v => { text.value = String(v) })

const clamp = v => Math.min(props.max, Math.max(props.min, v))
// Крок «прилипає» до сітки кроку: 2950 + 100 → 3000, а не 3050
const snap = (v, dir) => clamp(dir > 0 ? Math.floor(v / props.step) * props.step + props.step : Math.ceil(v / props.step) * props.step - props.step)

function bump(dir) {
  const v = snap(props.modelValue, dir)
  if (v !== props.modelValue) emit('update:modelValue', v)
}
function commit() {
  const n = Number(String(text.value).replace(',', '.'))
  if (Number.isFinite(n) && n >= props.min && n <= props.max && n > 0) emit('update:modelValue', n)
  else text.value = String(props.modelValue)
}

// ---------- утримання кнопки: перший повтор через 420 мс, далі дедалі частіше ----------
let tm = 0, n = 0
function hold(dir, e) {
  if (e.button != null && e.button !== 0) return
  bump(dir)
  n = 0
  const tick = () => { bump(dir); n++; tm = setTimeout(tick, Math.max(45, 140 - n * 12)) }
  tm = setTimeout(tick, 420)
}
const release = () => { clearTimeout(tm); tm = 0 }
onBeforeUnmount(release)
</script>

<template>
  <div class="st" role="group" :aria-label="ariaLabel || undefined">
    <button type="button" class="sb" :disabled="modelValue <= min" :aria-label="'−' + step"
            @pointerdown="hold(-1, $event)" @pointerup="release" @pointerleave="release" @pointercancel="release"
            @keydown.enter.space.prevent="bump(-1)">
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" /></svg>
    </button>
    <label class="sv">
      <input v-model="text" inputmode="decimal" autocomplete="off" :aria-label="ariaLabel || undefined"
             @change="commit" @keydown.enter="$event.target.blur()" @keydown.up.prevent="bump(1)" @keydown.down.prevent="bump(-1)">
      <span v-if="unit" class="su">{{ unit }}</span>
    </label>
    <button type="button" class="sb" :disabled="modelValue >= max" :aria-label="'+' + step"
            @pointerdown="hold(1, $event)" @pointerup="release" @pointerleave="release" @pointercancel="release"
            @keydown.enter.space.prevent="bump(1)">
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7M6 2.5v7" /></svg>
    </button>
  </div>
</template>

<style scoped>
.st{display:inline-flex;align-items:stretch;height:38px;border-radius:var(--r);background:var(--field-bg);border:1px solid var(--field-bd);overflow:hidden;
  transition:border-color var(--t-fast) var(--ease-out),box-shadow var(--t-fast) var(--ease-out)}
.st:focus-within{border-color:rgba(255,107,90,.7);box-shadow:var(--ring)}
/* Кнопки −/+ (селектор з .st перебиває загальні .view button) */
.st .sb{flex:none;width:38px;padding:0;margin:0;border:0;border-radius:0;background:transparent;color:var(--ink);cursor:pointer;display:grid;place-items:center;touch-action:manipulation;
  transition:background-color var(--t-fast) var(--ease-out),color var(--t-fast) var(--ease-out),transform var(--t-spring) var(--spring)}
.st .sb svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round}
.st .sb:hover:not(:disabled){background:rgba(255,255,255,.07);color:var(--coral)}
.st .sb:active:not(:disabled){background:rgba(255,107,90,.16);transform:scale(.92)}
.st .sb:disabled{opacity:.3;cursor:not-allowed}
.st .sb:focus-visible{outline:none;background:rgba(255,107,90,.14);color:var(--coral)}
.sv{display:flex;align-items:center;justify-content:center;gap:4px;min-width:84px;padding:0 4px;border-left:1px solid var(--hair);border-right:1px solid var(--hair);cursor:text}
.st .sv input{width:100%;min-width:0;padding:0;margin:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:var(--ink);font:inherit;font-size:13px;text-align:center;outline:none}
.st .sv input:focus{box-shadow:none;border:0}
.su{color:var(--dim);font-size:11px;white-space:nowrap}
</style>

<script setup>
// Вибір кольору в стилі macOS: квадрат насиченості/яскравості + смуга відтінку + поле HEX.
// Працює мишею, пальцем (pointer events) і клавіатурою (стрілки на повзунках).
import { ref, computed, watch } from 'vue'
import { hexToRgb, rgbToHex } from '@vyron/shared/theme'

const props = defineProps({ modelValue: { type: String, required: true } })
const emit = defineEmits(['update:modelValue'])

// ---------- HSV ↔ RGB ----------
function rgbToHsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [((h * 60) + 360) % 360, mx ? d / mx : 0, mx]
}
function hsvToRgb([h, s, v]) {
  const f = n => { const k = (n + h / 60) % 6; return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255 }
  return [f(5), f(3), f(1)]
}

const hsv = ref(rgbToHsv(hexToRgb(props.modelValue) || [255, 107, 90]))
// Зовнішня зміна (пресет) — оновлюємо повзунки, якщо колір справді інший
watch(() => props.modelValue, v => {
  if (rgbToHex(hsvToRgb(hsv.value)) !== v.toLowerCase()) { const rgb = hexToRgb(v); if (rgb) hsv.value = rgbToHsv(rgb) }
})
const hex = computed(() => rgbToHex(hsvToRgb(hsv.value)))
const hueColor = computed(() => rgbToHex(hsvToRgb([hsv.value[0], 1, 1])))
function commit() { emit('update:modelValue', hex.value) }

// ---------- перетягування ----------
const sv = ref(null), hue = ref(null)
function drag(el, fn) {
  return e => {
    e.preventDefault()
    const move = ev => {
      const r = el.value.getBoundingClientRect()
      fn(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)))
      commit()
    }
    move(e)
    el.value.setPointerCapture?.(e.pointerId)
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up) }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
  }
}
const onSv = drag(sv, (x, y) => { hsv.value = [hsv.value[0], x, 1 - y] })
const onHue = drag(hue, x => { hsv.value = [x * 359.9, hsv.value[1], hsv.value[2]] })
function key(e, kind) {
  const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: kind === 'sv' ? 1 : 1, ArrowDown: -1 }[e.key]
  if (!d) return
  e.preventDefault()
  const [h, s, v] = hsv.value, k = e.shiftKey ? 10 : 2
  if (kind === 'hue') hsv.value = [(h + d * k + 360) % 360, s, v]
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') hsv.value = [h, Math.min(1, Math.max(0, s + d * k / 100)), v]
  else hsv.value = [h, s, Math.min(1, Math.max(0, v + d * k / 100))]
  commit()
}

// ---------- HEX ----------
const text = ref(props.modelValue)
watch(hex, v => { text.value = v })
function onText() {
  const v = text.value.trim().replace(/^#?/, '#')
  const rgb = hexToRgb(v)
  if (!rgb) { text.value = hex.value; return }
  hsv.value = rgbToHsv(rgb)
  commit()
}
</script>

<template>
  <div class="cp">
    <div ref="sv" class="sv" :style="{ '--hue': hueColor }" role="slider" tabindex="0" :aria-valuetext="hex" aria-label="Saturation / brightness"
         @pointerdown="onSv" @keydown="key($event, 'sv')">
      <i class="knob" :style="{ left: hsv[1] * 100 + '%', top: (1 - hsv[2]) * 100 + '%', background: hex }"></i>
    </div>
    <div ref="hue" class="hue" role="slider" tabindex="0" aria-label="Hue" aria-valuemin="0" aria-valuemax="360" :aria-valuenow="Math.round(hsv[0])"
         @pointerdown="onHue" @keydown="key($event, 'hue')">
      <i class="knob" :style="{ left: hsv[0] / 360 * 100 + '%', background: hueColor }"></i>
    </div>
    <div class="row">
      <span class="sw" :style="{ background: hex }"></span>
      <input v-model="text" class="hx" maxlength="7" spellcheck="false" autocomplete="off" aria-label="HEX" @change="onText" @keydown.enter="onText">
    </div>
  </div>
</template>

<style scoped>
.cp{display:grid;gap:12px;width:100%}
.sv{position:relative;height:150px;border-radius:var(--r-md);cursor:crosshair;touch-action:none;
  background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,var(--hue));box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.hue{position:relative;height:16px;border-radius:999px;cursor:ew-resize;touch-action:none;
  background:linear-gradient(90deg,#f00,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.knob{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:2.5px solid #fff;pointer-events:none;
  box-shadow:0 2px 8px rgba(0,0,0,.5),inset 0 0 0 1px rgba(0,0,0,.15)}
.hue .knob{top:50%}
.sv:focus-visible,.hue:focus-visible{outline:2px solid var(--coral);outline-offset:3px}
.row{display:flex;align-items:center;gap:10px}
.sw{flex:none;width:34px;height:34px;border-radius:var(--r);box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}
.view .hx,.hx{flex:1;min-width:0;font:13px/1 var(--mono);text-transform:lowercase;padding:9px 12px}
</style>

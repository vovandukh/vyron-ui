<script setup>
// Візуалізація G-code поточного друку для слабкого екрана: псевдо-3D на звичайному canvas 2D
// (без WebGL — на SPI-екрані CB1 він програмний і повільний). Вигляд як у Vyron Web: ненадруковане —
// тонкі сірі лінії, надруковане — колір теми з чергуванням яскравості шарів.
// Економія: сірі лінії малюються один раз у прихований буфер; надруковане домальовується лише новими
// відрізками. Ракурс один — ізометрія; повна перемальовка лише при новій моделі, зміні розміру чи теми.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { model } from '@vyron/shared/gcode/model'
import { hexToRgb } from '@vyron/shared/theme'
import { usePrinter } from '../store'

const MAX_SEG = 40000      // скільки відрізків малюємо щонайбільше (решта зливається з сусідніми)
const TILT = 0.5           // ізометрія: глибина по Y стискається вдвічі (погляд згори під 30°)
const MAX_JOIN = 12        // мм: злиті відрізки довші за це не з'єднуємо (переїзди між островами)

const p = usePrinter()
const box = ref(null)
const cv = ref(null)
let base = null            // прихований буфер із сірими лініями
let S = null, L = null, I = null, n = 0   // екранні координати, шар і вихідний індекс кожного відрізка
let drawn = 0              // скільки відрізків уже пофарбовано як надруковані
const ANGLE = -Math.PI / 4  // фіксований ракурс: модель повернута на 45°, як класична ізометрія
let colors = ['#ff6b5a', '#ff9a8c']

function readColors() {
  const cs = getComputedStyle(document.documentElement)
  const c = cs.getPropertyValue('--coral').trim() || '#ff6b5a'
  // Світліший відтінок для непарних шарів — власним змішуванням (color-mix у canvas підтримують не всі кіоск-браузери)
  const rgb = hexToRgb(c) || [255, 107, 90]
  colors = [c, 'rgb(' + rgb.map(v => Math.round(v + (255 - v) * 0.38)).join(',') + ')']
}

/** Проєкція моделі в координати canvas (ізометрія з нахилом), з урахуванням розміру й поля */
function project(w, h) {
  const P = model.P, N = model.N, b = model.bounds
  if (!P || !N || !b) { n = 0; return }
  const step = Math.max(1, Math.ceil(N / MAX_SEG))
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, zs = model.zScale || 1
  const ca = Math.cos(ANGLE), sa = Math.sin(ANGLE)
  const cnt = Math.ceil(N / step)
  const raw = new Float32Array(cnt * 4)
  L = new Uint16Array(cnt); I = new Uint32Array(cnt)
  let k = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  const pr = (x, y, z, out, o) => {
    const dx = x - cx, dy = y - cy
    out[o] = dx * ca - dy * sa
    out[o + 1] = -z * zs + (dx * sa + dy * ca) * TILT
  }
  for (let i = 0; i < N; i += step) {
    const j = Math.min(N - 1, i + step - 1), a = i * 6, e = j * 6
    // Злиття: від початку першого до кінця останнього відрізка групи — лише в межах шару й без далеких стрибків
    const same = model.Lay[i] === model.Lay[j] && Math.hypot(P[e + 3] - P[a], P[e + 4] - P[a + 1]) < MAX_JOIN * step
    const ex = same ? e : a
    pr(P[a], P[a + 1], P[a + 2], raw, k * 4)
    pr(P[ex + 3], P[ex + 4], P[ex + 5], raw, k * 4 + 2)
    L[k] = model.Lay[i]; I[k] = j
    x0 = Math.min(x0, raw[k * 4], raw[k * 4 + 2]); x1 = Math.max(x1, raw[k * 4], raw[k * 4 + 2])
    y0 = Math.min(y0, raw[k * 4 + 1], raw[k * 4 + 3]); y1 = Math.max(y1, raw[k * 4 + 1], raw[k * 4 + 3])
    k++
  }
  n = k
  // Поля: зверху — під відсоток, знизу — під назву файлу й час (підписи лежать поверх моделі)
  const padX = w * 0.08, padT = h * 0.16, padB = h * 0.3
  const sc = Math.min((w - 2 * padX) / Math.max(1, x1 - x0), (h - padT - padB) / Math.max(1, y1 - y0))
  const ox = (w - (x1 - x0) * sc) / 2 - x0 * sc, oy = padT + (h - padT - padB - (y1 - y0) * sc) / 2 - y0 * sc
  S = raw
  for (let q = 0; q < n * 4; q += 2) { S[q] = S[q] * sc + ox; S[q + 1] = S[q + 1] * sc + oy }
}

function strokeRange(ctx, from, to, styleFor) {
  // Групуємо за кольором (парність шару), щоб робити лише два stroke() на виклик
  for (let par = 0; par < 2; par++) {
    ctx.beginPath()
    let any = false
    for (let k = from; k < to; k++) {
      if ((L[k] & 1) !== par) continue
      const o = k * 4
      ctx.moveTo(S[o], S[o + 1]); ctx.lineTo(S[o + 2], S[o + 3]); any = true
    }
    if (any) { ctx.strokeStyle = styleFor(par); ctx.stroke() }
  }
}

/** Скільки відрізків (у нашому зменшеному наборі) надруковано */
function printedCount() {
  const d = p.done
  if (!n || !d) return 0
  let lo = 0, hi = n
  while (lo < hi) { const m = (lo + hi) >> 1; if (I[m] < d) lo = m + 1; else hi = m }
  return lo
}

function full() {
  const c = cv.value, el = box.value
  if (!c || !el) return
  const dpr = window.devicePixelRatio || 1
  const w = el.clientWidth, h = el.clientHeight
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
  project(w, h)
  readColors()
  base = document.createElement('canvas')
  base.width = c.width; base.height = c.height
  const b = base.getContext('2d')
  b.scale(dpr, dpr); b.lineWidth = 1; b.lineCap = 'round'
  strokeRange(b, 0, n, par => (par ? 'rgba(160,170,190,.30)' : 'rgba(160,170,190,.20)'))
  const ctx = c.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.drawImage(base, 0, 0)
  drawn = 0
  more()
}

/** Домалювати надруковане з місця, де зупинились (або все заново, якщо прогрес пішов назад) */
function more() {
  const c = cv.value
  if (!c || !n) return
  const upto = printedCount()
  if (upto < drawn) { full(); return }
  if (upto === drawn) return
  const ctx = c.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineWidth = 1.4; ctx.lineCap = 'round'
  strokeRange(ctx, drawn, upto, par => colors[par])
  drawn = upto
}

let ro = null
onMounted(() => {
  full()
  ro = new ResizeObserver(() => full())
  ro.observe(box.value)
})
onBeforeUnmount(() => ro && ro.disconnect())
watch(() => p.modelVer, full)
watch(() => p.design, () => full())
watch(() => p.done, more)
</script>

<template>
  <div ref="box" class="gv" aria-hidden="true"><canvas ref="cv"></canvas></div>
</template>

<style scoped>
.gv{position:absolute;inset:0;overflow:hidden;pointer-events:none}
canvas{display:block;width:100%;height:100%}
</style>

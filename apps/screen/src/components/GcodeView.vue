<script setup>
// Візуалізація G-code поточного друку для слабкого екрана: псевдо-3D на звичайному canvas 2D
// (без WebGL — на SPI-екрані CB1 він програмний і повільний). Вигляд як у Vyron Web: ненадруковане —
// тонкі сірі лінії, надруковане — колір теми з чергуванням яскравості шарів.
// Економія: сірі лінії малюються один раз у прихований буфер; надруковане домальовується лише новими
// відрізками; повна перемальовка лише при новій моделі, зміні розміру, теми чи ракурсу.
// Ракурс можна крутити пальцем (вліво-вправо — поворот, вгору-вниз — нахил): під час жесту малюється
// спрощена модель (DRAG_SEG відрізків) щокадру, після відпускання — повна якість і знову дешевий режим.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { model } from '@vyron/shared/gcode/model'
import { hexToRgb } from '@vyron/shared/theme'
import { usePrinter } from '../store'

const MAX_SEG = 40000      // скільки відрізків малюємо щонайбільше (решта зливається з сусідніми)
const DRAG_SEG = 6000      // під час обертання пальцем — менше, щоб CB1 встигав малювати кадри
const TILT_MIN = 0.3, TILT_MAX = 0.65   // нахил: стиснення глибини (0.5 — погляд згори під 30°)
const SLOP = 10            // px: менший зсув пальця — це дотик (резистивний тач дрижить), а не обертання
const MAX_JOIN = 12        // мм: злиті відрізки довші за це не з'єднуємо (переїзди між островами)

const p = usePrinter()
const box = ref(null)
const cv = ref(null)
let base = null            // прихований буфер із сірими лініями
let S = null, L = null, I = null, D = null, n = 0   // екранні координати, шар, вихідний індекс і глибина кожного відрізка
/** «Підлога» під моделлю: центр і півосі еліпса на екрані */
let floor = null
// Глибина: каркас без підказок глибини око читає і «згори», і «знизу» (ефект куба Неккера).
// Тому задні лінії тьмяніші за передні — три смуги, лише різна прозорість при малюванні.
const BAND_ALPHA = [0.38, 0.7, 1]
let drawn = 0              // скільки відрізків уже пофарбовано як надруковані
// Ракурс: поворот навколо вертикалі й нахил; спершу — класична ізометрія (45°, погляд згори під 30°)
let ang = -Math.PI / 4, tilt = 0.5
let colors = ['#ff6b5a', '#ff9a8c']

function readColors() {
  const cs = getComputedStyle(document.documentElement)
  const c = cs.getPropertyValue('--coral').trim() || '#ff6b5a'
  // Світліший відтінок для непарних шарів — власним змішуванням (color-mix у canvas підтримують не всі кіоск-браузери)
  const rgb = hexToRgb(c) || [255, 107, 90]
  colors = [c, 'rgb(' + rgb.map(v => Math.round(v + (255 - v) * 0.38)).join(',') + ')']
}

/** Проєкція моделі в координати canvas (ізометрія з нахилом), з урахуванням розміру й поля */
function project(w, h, maxSeg = MAX_SEG) {
  const P = model.P, N = model.N, b = model.bounds
  if (!P || !N || !b) { n = 0; floor = null; return }
  const step = Math.max(1, Math.ceil(N / maxSeg))
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, zs = model.zScale || 1
  const ca = Math.cos(ang), sa = Math.sin(ang), TILT = tilt
  const cnt = Math.ceil(N / step)
  const raw = new Float32Array(cnt * 4)
  L = new Uint16Array(cnt); I = new Uint32Array(cnt); D = new Uint8Array(cnt)
  // Радіус «відбитка» моделі на столі — для смуг глибини й еліпса підлоги
  const R = Math.max(1, Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2)
  let k = 0
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
    // глибина середини відрізка: від'ємна — далі від глядача, додатна — ближче
    const mx = (P[a] + P[ex + 3]) / 2 - cx, my = (P[a + 1] + P[ex + 4]) / 2 - cy
    const dep = mx * sa + my * ca
    D[k] = dep < -R / 3 ? 0 : dep > R / 3 ? 2 : 1
    k++
  }
  n = k
  // Межі кадру не залежать від ракурсу (коло радіусом R навколо центру, найбільший нахил) —
  // при обертанні модель не стрибає й не змінює розмір. Підлога — еліпс трохи ширший за відбиток.
  const FR = R * 1.05, top = (model.zmax || 0) * zs
  const x0 = -FR, x1 = FR, y0 = -top - FR * TILT_MAX, y1 = FR * TILT_MAX
  // Поля: знизу — під скляну плашку з відсотком і назвою (модель може ледь заходити під її верх)
  const padX = w * 0.04, padT = h * 0.03, padB = h * 0.22
  const sc = Math.min((w - 2 * padX) / Math.max(1, x1 - x0), (h - padT - padB) / Math.max(1, y1 - y0))
  const ox = (w - (x1 - x0) * sc) / 2 - x0 * sc, oy = padT + (h - padT - padB - (y1 - y0) * sc) / 2 - y0 * sc
  S = raw
  for (let q = 0; q < n * 4; q += 2) { S[q] = S[q] * sc + ox; S[q + 1] = S[q + 1] * sc + oy }
  // Точка (cx, cy, 0) у проєкції — це (0, 0), тобто на екрані (ox, oy)
  floor = { x: ox, y: oy, rx: FR * sc, ry: FR * TILT * sc }
}

/** Стіл під моделлю: м'яке світле коло з тонким краєм — підказує, що дивимось згори */
function drawFloor(ctx) {
  if (!floor) return
  const { x, y, rx, ry } = floor
  ctx.save()
  ctx.translate(x, y); ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, 'rgba(255,255,255,.075)'); g.addColorStop(0.7, 'rgba(255,255,255,.035)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  ctx.beginPath(); ctx.ellipse(x, y, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.stroke()
}

function strokeRange(ctx, from, to, styleFor) {
  // Групуємо за кольором (парність шару) і глибиною: шість stroke() на виклик, спершу задні, потім передні
  for (let band = 0; band < 3; band++) {
    ctx.globalAlpha = BAND_ALPHA[band]
    for (let par = 0; par < 2; par++) {
      ctx.beginPath()
      let any = false
      for (let k = from; k < to; k++) {
        if ((L[k] & 1) !== par || D[k] !== band) continue
        const o = k * 4
        ctx.moveTo(S[o], S[o + 1]); ctx.lineTo(S[o + 2], S[o + 3]); any = true
      }
      if (any) { ctx.strokeStyle = styleFor(par); ctx.stroke() }
    }
  }
  ctx.globalAlpha = 1
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
  b.scale(dpr, dpr)
  drawFloor(b)
  b.lineWidth = 1; b.lineCap = 'round'
  strokeRange(b, 0, n, par => (par ? 'rgba(160,170,190,.30)' : 'rgba(160,170,190,.20)'))
  const ctx = c.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.drawImage(base, 0, 0)
  drawn = 0
  more()
}

/** Кадр під час обертання: спрощена модель, усе одразу на видимому полотні (без буфера) */
function quick() {
  const c = cv.value, el = box.value
  if (!c || !el) return
  const dpr = window.devicePixelRatio || 1
  project(el.clientWidth, el.clientHeight, DRAG_SEG)
  const ctx = c.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawFloor(ctx)
  ctx.lineCap = 'round'
  const up = printedCount()
  ctx.lineWidth = 1
  strokeRange(ctx, up, n, par => (par ? 'rgba(160,170,190,.30)' : 'rgba(160,170,190,.20)'))
  ctx.lineWidth = 1.4
  strokeRange(ctx, 0, up, par => colors[par])
}

// ---------- обертання пальцем ----------
let drag = null, raf = 0, dragEnd = 0
function onDown(e) {
  if (e.button > 0 || !n) return
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, a: ang, t: tilt, moved: false }
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < SLOP) return
    drag.moved = true
    try { box.value.setPointerCapture(e.pointerId) } catch { /* подія вже не активна */ }
  }
  ang = drag.a + dx * 0.012
  tilt = Math.min(TILT_MAX, Math.max(TILT_MIN, drag.t + dy * 0.003))
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; quick() })
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return
  const moved = drag.moved
  drag = null
  if (!moved) return
  cancelAnimationFrame(raf); raf = 0
  dragEnd = performance.now()
  full()                     // повна якість, далі знову лише дорисовування нового
}
/** Клік одразу після обертання не повинен відкривати «Тонке налаштування» */
function onClick(e) { if (performance.now() - dragEnd < 400) { e.stopPropagation(); e.preventDefault() } }

/** Домалювати надруковане з місця, де зупинились (або все заново, якщо прогрес пішов назад) */
function more() {
  const c = cv.value
  if (!c || !n || drag) return
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
  <div ref="box" class="gv" aria-hidden="true" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @click.capture="onClick"><canvas ref="cv"></canvas></div>
</template>

<style scoped>
.gv{position:absolute;inset:0;overflow:hidden;touch-action:none}
canvas{display:block;width:100%;height:100%}
</style>

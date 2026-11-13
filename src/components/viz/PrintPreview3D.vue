<script setup>
// Повноекранний 3D-перегляд друку (Three.js) на фоні інтерфейсу.
// Демо-модель і реальні G-code рендеряться одним кодом: однаковий видимий крок шарів,
// стиль ліній, кольори інструментів, поділ «надруковано / поточний шар / майбутні шари».
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { usePrinterStore } from '../../stores/printerStore'
import { useOrbitCamera } from '../../composables/useOrbitCamera'
import { model, BED } from '../../services/gcodeModel'

// ---------- кольори ----------
const GRAY = [0.24, 0.26, 0.29]               // майбутні шари
const HILITE = [1, 0.93, 0.88]                // поточний шар
/** Надрукована частина: градієнт [низ → верх] для кожного інструмента; T0 — фірмовий червоний. */
const TOOL_COLORS = [
  [[0.93, 0.28, 0.23], [1, 0.68, 0.62]],      // T0 червоний
  [[0.30, 0.47, 1.00], [0.70, 0.80, 1.00]],   // T1 синій
  [[0.25, 0.80, 0.45], [0.70, 0.95, 0.78]],   // T2 зелений
  [[1.00, 0.62, 0.15], [1.00, 0.85, 0.55]],   // T3 бурштиновий
  [[0.66, 0.40, 1.00], [0.86, 0.75, 1.00]],   // T4 фіолетовий
  [[0.15, 0.80, 0.85], [0.65, 0.95, 0.95]]    // T5 бірюзовий
]

// ---------- вигляд шарів (підібрано на реальних моделях разом із Z_SCALE_MAX у gcodeModel.js) ----------
const LAY_DIM = 0.4        // яскравість кожного другого видимого шару — чіткі смуги між шарами
// Майбутні (сірі) шари: м'якше чергування, інакше сіра частина реальних моделей темніша,
// ніж у демо-вази (де чергування вимкнене).
const FUT_DIM = 0.75
const AMBIENT = 0.55       // «бічне світло»: яскравість стінки в повній тіні
const LIGHT = (() => { const x = -0.6, y = 0.8, l = Math.hypot(x, y); return [x / l, y / l] })()
const GAIN = 1.25          // компенсує затемнення від чергування й тіні
/**
 * Еталонний видимий крок шарів = як у демо-вази (виток 0.8 мм при її кадруванні):
 * крок шару у світі / відстань камери. Якщо навіть після розтягування Z (≤ Z_SCALE_MAX) шари
 * дрібніші — малюється кожен step-й шар (LOD). Step перераховується від поточного зуму:
 * при наближенні модель знову показується з усіма шарами.
 */
const PITCH_PER_DIST = 0.0029
const VASE_WINDOW = 90     // «поточний шар» спіральної вази — останній виток (~90 сегментів)

const printer = usePrinterStore()
const cv = ref(null)
const orbit = useOrbitCamera(cv, { rotX: 0.45, rotY: 0.7, dist: 650, speed: 0.007, minX: -0.1, maxX: 1.5, wheel: true, minDist: 20, maxDist: 1600 })

let renderer, scene, cam, lines = null, colAttr = null, raf = 0
const target = new THREE.Vector3(0, 35, 0)

// Стан геометрії
let Lit = null        // освітленість кожного сегмента (від напрямку стінки), рахується раз на модель
let Sh = null         // підсумкова яскравість сегмента для поточного step
let G = null          // індекси сегментів моделі, що є в геометрії (зростають)
let step = 1          // LOD: малюється кожен step-й шар
let painted = 0       // done, з яким пофарбовано геометрію
let hl = 0            // початок підсвіченого поточного шару (індекс сегмента)

// ---------- допоміжне ----------
const lowerBound = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m } return lo }

function computeLight() {
  const { P, N } = model
  Lit = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const o = i * 6, dx = P[o + 3] - P[o], dy = P[o + 4] - P[o + 1], len = Math.hypot(dx, dy) || 1
    // нормаль стінки в площині XY; |n·L| — освітленість без знаку (обхід периметра CW/CCW невідомий)
    Lit[i] = AMBIENT + (1 - AMBIENT) * Math.abs((dy / len) * LIGHT[0] - (dx / len) * LIGHT[1])
  }
}

/** Бажаний step для поточної відстані камери. */
function stepFor(dist) {
  const lh = model.layerHeight
  if (!lh) return 1                         // ваза / без регулярних шарів
  const raw = (PITCH_PER_DIST * dist) / (lh * model.zScale)
  return Math.max(1, Math.round(raw))
}

/** Початок «поточного шару» для підсвічування: останні step шарів (щоб хоч один був у геометрії). */
function hlStart(done) {
  if (!done || printer.preview) return done          // у перегляді файлу поточного шару немає
  if (!model.layerHeight) return Math.max(0, done - VASE_WINDOW)
  const Lay = model.Lay, from = Lay[done - 1] - step + 1
  let j = done - 1
  while (j > 0 && Lay[j - 1] >= from) j--
  return j
}

function colorOf(i, done, a, q) {
  const k = Sh[i]
  if (i >= done) {
    const f = GAIN * Lit[i] * (!model.layerHeight || Math.floor(model.Lay[i] / step) & 1 ? 1 : FUT_DIM)
    a[q] = GRAY[0] * f; a[q + 1] = GRAY[1] * f; a[q + 2] = GRAY[2] * f; return
  }
  if (i >= hl) {
    const h = Math.min(1, 0.8 + 0.2 * Lit[i] * GAIN)
    a[q] = HILITE[0] * h; a[q + 1] = HILITE[1] * h; a[q + 2] = HILITE[2] * h; return
  }
  const [A, B] = TOOL_COLORS[model.T[i] % TOOL_COLORS.length], z = model.P[i * 6 + 2] / model.zmax
  a[q] = (A[0] + (B[0] - A[0]) * z) * k
  a[q + 1] = (A[1] + (B[1] - A[1]) * z) * k
  a[q + 2] = (A[2] + (B[2] - A[2]) * z) * k
}

/** Перефарбувати сегменти моделі з індексами [from, to). */
function repaint(from, to, done) {
  if (!colAttr) return
  const a = colAttr.array
  for (let g = lowerBound(G, from), end = lowerBound(G, to); g < end; g++) {
    const i = G[g], o = g * 6
    colorOf(i, done, a, o)
    a[o + 3] = a[o]; a[o + 4] = a[o + 1]; a[o + 5] = a[o + 2]
  }
  colAttr.needsUpdate = true
}

// ---------- побудова ----------
function disposeLines() {
  if (lines) { scene.remove(lines); lines.geometry.dispose(); lines.material.dispose(); lines = null }
  colAttr = null
}

/** Геометрія для заданого step: лише видимі шари; верхній шар моделі завжди видимий. */
function buildGeometry(newStep) {
  disposeLines()
  const { P, N, Lay, zScale: zs } = model
  if (!P || !N) { G = new Int32Array(0); return }
  step = newStep
  const top = model.layers.length - 1, r = ((top % step) + step) % step
  const dim = model.layerHeight ? LAY_DIM : 1
  const keep = []
  Sh = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    if (step > 1 && Lay[i] % step !== r) continue
    keep.push(i)
    // чергування рахується серед ВИДИМИХ шарів, тож смуги лишаються чіткими і при проріджуванні
    Sh[i] = GAIN * Lit[i] * (Math.floor(Lay[i] / step) & 1 ? 1 : dim)
  }
  G = Int32Array.from(keep)
  const pos = new Float32Array(G.length * 6), col = new Float32Array(G.length * 6)
  for (let g = 0; g < G.length; g++) {
    const o = G[g] * 6, q = g * 6
    // Z множиться на zScale (видимий крок шарів, див. gcodeModel.js); X/Y без змін.
    pos[q] = P[o] - BED[0] / 2; pos[q + 1] = P[o + 2] * zs; pos[q + 2] = -(P[o + 1] - BED[1] / 2)
    pos[q + 3] = P[o + 3] - BED[0] / 2; pos[q + 4] = P[o + 5] * zs; pos[q + 5] = -(P[o + 4] - BED[1] / 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  colAttr = new THREE.BufferAttribute(col, 3)
  geo.setAttribute('color', colAttr)
  lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true }))
  scene.add(lines)
  painted = Math.min(printer.done, N)
  hl = hlStart(painted)
  repaint(0, N, painted)
}

/** Нова модель: кадрування (без purge-лінії/skirt першого шару — див. gcodeModel), світло, геометрія. */
function build() {
  if (!model.P || !model.N) { disposeLines(); return }
  computeLight()
  const b = model.bounds
  if (b) {
    const h = model.zmax * model.zScale
    target.set((b.x0 + b.x1) / 2 - BED[0] / 2, h / 2, -((b.y0 + b.y1) / 2 - BED[1] / 2))
    orbit.dist = Math.max(b.x1 - b.x0, b.y1 - b.y0, h) * 2.1 + 25
  }
  buildGeometry(stepFor(orbit.dist))
}

/** Прогрес змінився: перефарбувати лише змінений діапазон (надруковане / поточний шар / майбутнє). */
function paintTo(n) {
  if (!colAttr || !model.P) return
  n = Math.min(n, model.N)
  const newHl = hlStart(n)
  if (n === painted && newHl === hl) return
  const from = Math.min(painted, n, hl, newHl), to = Math.max(painted, n)
  hl = newHl
  painted = n
  repaint(from, to, n)
}

// LOD: після зміни зуму (і короткої паузи) перебудувати геометрію з іншим step.
let lodAt = 0
function checkLod(now) {
  if (!model.layerHeight || !model.N) return
  const want = stepFor(orbit.dist)
  if (want === step) { lodAt = 0; return }
  if (!lodAt) { lodAt = now; return }
  if (now - lodAt > 200) { lodAt = 0; buildGeometry(want) }
}

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
  renderer.setSize(innerWidth, innerHeight, false)
  cam.aspect = innerWidth / innerHeight
  cam.updateProjectionMatrix()
}

function loop(now) {
  checkLod(now || 0)
  orbit.place(cam, target)
  renderer.render(scene, cam)
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ canvas: cv.value, antialias: true, alpha: true })
  scene = new THREE.Scene()
  cam = new THREE.PerspectiveCamera(40, 1, 1, 5000)
  addEventListener('resize', resize)
  resize()
  build()
  loop()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  removeEventListener('resize', resize)
  disposeLines()
  renderer?.dispose()
})

watch(() => printer.modelVersion, build)
watch(() => printer.done, paintTo)
</script>

<template>
  <canvas ref="cv" class="bg3d"></canvas>
</template>

<style scoped>
.bg3d{position:fixed;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none}
</style>

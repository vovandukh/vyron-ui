<script setup>
// Повноекранний 3D-перегляд друку (Three.js) на фоні інтерфейсу.
// Демо-модель і реальні G-code рендеряться одним кодом: однаковий видимий крок шарів,
// стиль ліній, кольори інструментів, поділ «надруковано / поточний шар / майбутні шари».
// Рендер — на вимогу: поки камера нерухома, друк не йде і нічого не змінюється, цикл спить
// (GPU не навантажується); під відкритою панеллю вкладки сцена не перемальовується зовсім.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { usePrinterStore } from '../../stores/printerStore'
import { useUiStore } from '../../stores/uiStore'
import { useOrbitCamera } from '../../composables/useOrbitCamera'
import { model, BED } from '../../services/gcodeModel'

// ---------- кольори ----------
const GRAY = [0.24, 0.26, 0.29]               // майбутні шари
const HILITE = [1, 0.93, 0.88]                // поточний шар
const CORAL = 0xff6b5a, ICE = 0x7cc7ff
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

// ---------- робоча область Voron 2.4 350 (каркас у режимі очікування) ----------
const HALF = BED[0] / 2, VOL_H = 330
const IDLE_VIEW = { target: [0, 70, 0], dist: 980 }
const HOME_ROT = { rotX: 0.45, rotY: 0.7 }
const PULSE_MS = 1700      // період «дихання» поточного шару
const PULSE_FPS = 30       // коли рухається лише пульсація — рендеримо вдвічі рідше

const printer = usePrinterStore()
const ui = useUiStore()
const cv = ref(null)
const orbit = useOrbitCamera(cv, { ...HOME_ROT, dist: 650, speed: 0.007, minX: -0.1, maxX: 1.5, wheel: true, pan: true, minDist: 20, maxDist: 2200 })

let renderer, scene, cam, lines = null, colAttr = null, raf = 0
const target = new THREE.Vector3(...IDLE_VIEW.target)
const targetGoal = target.clone()

// Стан геометрії
let Lit = null        // освітленість кожного сегмента (від напрямку стінки), рахується раз на модель
let Sh = null         // підсумкова яскравість сегмента для поточного step
let G = null          // індекси сегментів моделі, що є в геометрії (зростають)
let step = 1          // LOD: малюється кожен step-й шар
let painted = 0       // done, з яким пофарбовано геометрію
let hl = 0            // початок підсвіченого поточного шару (індекс сегмента)

// Рендер на вимогу
let dirty = true, lastFrame = 0, lastNow = 0
const printing = computed(() => printer.printState === 'printing' && !printer.preview)

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

/** Сегмент моделі i → координати сцени (Y — вгору, Z розтягнуто на zScale). */
function segTo(out, q, i) {
  const P = model.P, o = i * 6, zs = model.zScale
  out[q] = P[o] - HALF; out[q + 1] = P[o + 2] * zs; out[q + 2] = -(P[o + 1] - HALF)
  out[q + 3] = P[o + 3] - HALF; out[q + 4] = P[o + 5] * zs; out[q + 5] = -(P[o + 4] - HALF)
}

// ---------- побудова ----------
function disposeLines() {
  if (lines) { scene.remove(lines); lines.geometry.dispose(); lines.material.dispose(); lines = null }
  colAttr = null
}

/** Геометрія для заданого step: лише видимі шари; верхній шар моделі завжди видимий. */
function buildGeometry(newStep) {
  disposeLines()
  const { P, N, Lay } = model
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
  for (let g = 0; g < G.length; g++) segTo(pos, g * 6, G[g])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  colAttr = new THREE.BufferAttribute(col, 3)
  geo.setAttribute('color', colAttr)
  lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true }))
  scene.add(lines)
  painted = Math.min(printer.done, N)
  hl = hlStart(painted)
  repaint(0, N, painted)
  updateGlow()
  kick()
}

/** Нова модель: кадрування (без purge-лінії/skirt першого шару — див. gcodeModel), світло, геометрія. */
function build() {
  if (!model.P || !model.N) {
    disposeLines()
    targetGoal.set(...IDLE_VIEW.target)
    orbit.frame({ dist: IDLE_VIEW.dist, ...HOME_ROT })
    updateGlow()
    kick()
    return
  }
  computeLight()
  const b = model.bounds
  if (b) {
    const h = model.zmax * model.zScale
    targetGoal.set((b.x0 + b.x1) / 2 - HALF, h / 2, -((b.y0 + b.y1) / 2 - HALF))
    orbit.frame({ dist: Math.max(b.x1 - b.x0, b.y1 - b.y0, h) * 2.1 + 25, ...HOME_ROT })
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
  updateGlow()
  kick()
}

// LOD: після зміни зуму (і короткої паузи) перебудувати геометрію з іншим step.
let lodAt = 0
function checkLod(now) {
  if (!model.layerHeight || !model.N) { lodAt = 0; return }
  const want = stepFor(orbit.dist)
  if (want === step) { lodAt = 0; return }
  if (!lodAt) { lodAt = now; return }
  if (now - lodAt > 200) { lodAt = 0; buildGeometry(want) }
}

// ================= сцена: стіл, каркас, світіння =================
const fx = { stage: null, idle: null, glowLines: null, halo: null, bedGlow: null, idleFade: 1, idleGoal: 1, mats: [] }

/** Матеріал ліній каркаса; base — непрозорість при повній видимості (множиться на згасання каркаса). */
function lineMat(color, base) {
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: base, depthWrite: false })
  fx.mats.push({ m, base })
  return m
}
function segments(arr, mat) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
  return new THREE.LineSegments(g, mat)
}
/** Текстова мітка-спрайт (підписи осей). */
function label(text, color, size, x, y, z) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d'), fs = 64
  const font = `500 ${fs}px Montserrat, system-ui, sans-serif`
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 16
  c.width = w; c.height = fs + 16
  ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  ctx.fillText(text, w / 2, c.height / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  fx.mats.push({ m, base: 1 })
  const s = new THREE.Sprite(m)
  s.scale.set((size * w) / c.height, size, 1)
  s.position.set(x, y, z)
  return s
}
/** М'яка радіальна пляма (світіння) — спільна текстура для гало шару й відбиття від столу. */
function glowPlane(tex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, color: CORAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
  m.rotation.x = -Math.PI / 2
  m.visible = false
  return m
}
function radialTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function makeStage() {
  const S = HALF
  fx.stage = new THREE.Group(); fx.idle = new THREE.Group()
  // Сітка столу: тонкі лінії кожні 25 мм, акцентні — кожні 50 мм, рамка — яскравіша
  const minor = [], major = []
  for (let i = 0; i <= BED[0] / 25; i++) {
    const v = -S + i * 25, arr = i % 2 ? minor : major
    if (i === 0 || i === BED[0] / 25) continue
    arr.push(v, 0, -S, v, 0, S, -S, 0, v, S, 0, v)
  }
  fx.stage.add(segments(minor, lineMat(0xffffff, 0.035)))
  fx.stage.add(segments(major, lineMat(0xffffff, 0.07)))
  fx.stage.add(segments([-S, 0, -S, S, 0, -S, S, 0, -S, S, 0, S, S, 0, S, -S, 0, S, -S, 0, S, -S, 0, -S], lineMat(0xffffff, 0.16)))
  // Об'єм друку: вертикальні ребра + верхня рамка
  const box = []
  for (const [x, z] of [[-S, -S], [S, -S], [S, S], [-S, S]]) box.push(x, 0, z, x, VOL_H, z)
  box.push(-S, VOL_H, -S, S, VOL_H, -S, S, VOL_H, -S, S, VOL_H, S, S, VOL_H, S, -S, VOL_H, S, -S, VOL_H, S, -S, VOL_H, -S)
  fx.idle.add(segments(box, lineMat(0xffffff, 0.06)))
  // Осі від початку координат (передній лівий кут): X — кораловий, Y — крижаний
  const o = [-S, 0.5, S], A = 70
  fx.idle.add(segments([...o, -S + A, 0.5, S, -S + A, 0.5, S, -S + A - 7, 0.5, S - 4, -S + A, 0.5, S, -S + A - 7, 0.5, S + 4], lineMat(CORAL, 0.9)))
  fx.idle.add(segments([...o, -S, 0.5, S - A, -S, 0.5, S - A, -S - 4, 0.5, S - A + 7, -S, 0.5, S - A, -S + 4, 0.5, S - A + 7], lineMat(ICE, 0.9)))
  // Лише назви осей — жодних розмірів, щоб каркас лишався універсальним для будь-якого столу
  fx.idle.add(label('X', '#ff6b5a', 16, -S + A + 12, 2, S))
  fx.idle.add(label('Y', '#7cc7ff', 16, -S, 2, S - A - 12))
  scene.add(fx.stage, fx.idle)

  // Світіння: гало на висоті поточного шару, тепле відбиття від столу, коралова «аура» ліній поточного шару
  const tex = radialTexture()
  fx.halo = glowPlane(tex); fx.bedGlow = glowPlane(tex)
  fx.bedGlow.position.y = 0.3
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
  fx.glowLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: CORAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
  fx.glowLines.visible = false
  scene.add(fx.halo, fx.bedGlow, fx.glowLines)
}

/** Оновити геометрію світіння під поточний шар/модель. Пульсацію (opacity) рахує цикл. */
function updateGlow() {
  if (!fx.stage) return
  const has = !!(model.P && model.N)
  fx.idleGoal = has ? 0 : 1
  const b = model.bounds
  const fw = b ? Math.max(b.x1 - b.x0, 30) : 0, fd = b ? Math.max(b.y1 - b.y0, 30) : 0
  const cx = b ? (b.x0 + b.x1) / 2 - HALF : 0, cz = b ? -((b.y0 + b.y1) / 2 - HALF) : 0
  // Відбиття від столу — під моделлю, яскравість від температури столу (холодний — нічого)
  const bedK = Math.min(1, Math.max(0, ((printer.bedTemp ?? 0) - 35) / 75))
  fx.bedGlow.visible = has && bedK > 0.02
  fx.bedGlow.position.set(cx, 0.3, cz)
  fx.bedGlow.scale.set(fw * 2.4, fd * 2.4, 1)
  fx.bedGlow.material.opacity = 0.28 * bedK
  // Поточний шар — лише під час друку
  const live = has && printing.value && painted > 0 && hl < painted
  fx.halo.visible = fx.glowLines.visible = live
  if (!live) return
  const zNow = model.P[(painted - 1) * 6 + 5] * model.zScale
  fx.halo.position.set(cx, zNow + 0.4, cz)
  fx.halo.scale.set(fw * 1.7, fd * 1.7, 1)
  // Лінії поточного шару (до кількох тисяч сегментів) — у буфер із запасом, без перевиділення щокадру
  const n = painted - hl, geo = fx.glowLines.geometry
  let attr = geo.getAttribute('position')
  if (attr.array.length < n * 6) {
    attr = new THREE.BufferAttribute(new Float32Array(Math.max(n * 6, 64) * 2), 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', attr)
  }
  for (let i = 0; i < n; i++) segTo(attr.array, i * 6, hl + i)
  attr.needsUpdate = true
  geo.setDrawRange(0, n * 2)
  geo.computeBoundingSphere()
}

function applyFx(now, dt) {
  // Плавна поява/зникнення каркаса очікування
  let anim = false
  if (Math.abs(fx.idleFade - fx.idleGoal) > 0.002) {
    fx.idleFade += (fx.idleGoal - fx.idleFade) * (1 - Math.exp(-dt * 6))
    anim = true
  } else fx.idleFade = fx.idleGoal
  // Увесь каркас (сітка, рамка, об'єм, осі) повністю зникає, коли на сцені модель друку
  fx.idle.visible = fx.stage.visible = fx.idleFade > 0.01
  for (const { m, base } of fx.mats) m.opacity = base * fx.idleFade
  // «Дихання» поточного шару
  if (fx.halo.visible) {
    const p = 0.5 - 0.5 * Math.cos((now / PULSE_MS) * Math.PI * 2)
    fx.halo.material.opacity = 0.1 + 0.22 * p
    fx.glowLines.material.opacity = 0.25 + 0.5 * p
  }
  return anim
}

// ================= цикл рендерингу на вимогу =================
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
  renderer.setSize(innerWidth, innerHeight, false)
  cam.aspect = innerWidth / innerHeight
  cam.updateProjectionMatrix()
  kick()
}

/** Позначити кадр застарілим і розбудити цикл, якщо він спить. */
function kick() {
  dirty = true
  if (!raf && renderer) { lastNow = 0; raf = requestAnimationFrame(loop) }
}
orbit.wake = kick

function loop(now) {
  raf = 0
  const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0
  lastNow = now
  const moving = orbit.update(now)
  let tMoving = false
  if (target.distanceToSquared(targetGoal) > 0.0025) { target.lerp(targetGoal, 1 - Math.exp(-dt * 7)); tMoving = true } else target.copy(targetGoal)
  checkLod(now)
  const fading = applyFx(now, dt)
  const pulsing = fx.halo.visible
  const busy = moving || tMoving || fading || lodAt
  // Панель вкладки закриває сцену — не малюємо, поки її не закриють (watch(ui.view) розбудить).
  const covered = ui.view !== 'main'
  if (!covered && (busy || dirty || (pulsing && now - lastFrame >= 1000 / PULSE_FPS))) {
    orbit.place(cam, target)
    renderer.render(scene, cam)
    lastFrame = now
    dirty = false
  }
  // Спимо, коли нічого не рухається; пульсація під час друку тримає цикл живим (30 fps).
  if (busy || (pulsing && !covered)) raf = requestAnimationFrame(loop)
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ canvas: cv.value, antialias: true, alpha: true })
  scene = new THREE.Scene()
  cam = new THREE.PerspectiveCamera(40, 1, 1, 6000)
  makeStage()
  addEventListener('resize', resize)
  resize()
  build()
  // Підписи осей малюються шрифтом інтерфейсу — перебудувати, коли він завантажиться
  document.fonts?.ready?.then(() => {
    if (!scene) return
    for (const g of [fx.stage, fx.idle, fx.halo, fx.bedGlow, fx.glowLines]) {
      scene.remove(g)
      g.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose() })
    }
    fx.mats = []
    makeStage(); updateGlow(); kick()
  })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  removeEventListener('resize', resize)
  disposeLines()
  scene?.traverse(o => {
    o.geometry?.dispose?.()
    if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.() }
  })
  renderer?.dispose()
  scene = null
})

watch(() => printer.modelVersion, build)
watch(() => printer.done, paintTo)
watch(printing, () => { updateGlow(); kick() })
watch(() => Math.round((printer.bedTemp ?? 0) / 5), () => { updateGlow(); kick() })
watch(() => ui.view, kick)
</script>

<template>
  <canvas ref="cv" class="bg3d"></canvas>
</template>

<style scoped>
.bg3d{position:fixed;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none}
.bg3d:active{cursor:grabbing}
</style>

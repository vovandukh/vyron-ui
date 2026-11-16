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
import { useI18n } from '../../composables/useI18n'
import { model } from '@vyron/shared/gcode/model'
import { hexToRgb } from '@vyron/shared/theme'
import { useDesignStore } from '../../stores/designStore'
import { MOBILE_QUERY } from '../../composables/useMobile'

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
const T0_VORON = TOOL_COLORS[0]
/** Колір світіння поточного шару — акцент теми (сторінка «Дизайн») */
let glowColor = CORAL

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

// ---------- робоча область (каркас у режимі очікування) ----------
// Форма й розміри — з Klipper (printer.bed): прямокутний стіл або круглий (дельта, polar).
// Центр столу — початок координат сцени; Y сцени — вгору, Z сцени — до глядача (= −Y принтера).
let B = null
// Круглий об'єм (дельта) зазвичай вищий за ширину — камера трохи далі, щоб верхнє коло не впиралось у шапку
const idleView = () => ({ target: [0, B.h * 0.21, 0], dist: Math.max(B.w, B.d, B.h) * (B.round ? 3.2 : 2.8) })
const HOME_ROT = { rotX: 0.45, rotY: 0.7 }
// Дельта: камера строго спереду (між вежами A і B) — трикутник веж симетричний у кадрі
const homeRot = () => (B && B.round ? { rotX: 0.45, rotY: 0 } : HOME_ROT)
const PULSE_MS = 1700      // період «дихання» поточного шару
const PULSE_FPS = 30       // коли рухається лише пульсація — рендеримо вдвічі рідше

const printer = usePrinterStore()
const ui = useUiStore()
const cv = ref(null)
const orbit = useOrbitCamera(cv, { ...HOME_ROT, dist: 650, speed: 0.007, minX: -0.1, maxX: 1.5, wheel: true, pan: true, minDist: 20, maxDist: 2200 })

// Кнопка «Скинути ракурс» видна, лише коли камеру зрушено (верхньорівневий ref — щоб шаблон розгорнув його)
const camMoved = orbit.isCameraMoved
const { t } = useI18n()

let renderer, scene, cam, lines = null, colAttr = null, raf = 0
B = printer.bed
const target = new THREE.Vector3(...idleView().target)
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
  out[q] = P[o] - B.cx; out[q + 1] = P[o + 2] * zs; out[q + 2] = -(P[o + 1] - B.cy)
  out[q + 3] = P[o + 3] - B.cx; out[q + 4] = P[o + 5] * zs; out[q + 5] = -(P[o + 4] - B.cy)
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
    const v = idleView()
    targetGoal.set(...v.target)
    orbit.frame({ dist: v.dist, ...homeRot() })
    updateGlow()
    kick()
    return
  }
  computeLight()
  const b = model.bounds
  if (b) {
    const h = model.zmax * model.zScale
    targetGoal.set((b.x0 + b.x1) / 2 - B.cx, h / 2, -((b.y0 + b.y1) / 2 - B.cy))
    orbit.frame({ dist: Math.max(b.x1 - b.x0, b.y1 - b.y0, h) * 2.1 + 25, ...homeRot() })
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
    new THREE.MeshBasicMaterial({ map: tex, color: glowColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
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

/** Коло радіусом r на висоті y (відрізками) */
function circle(r, y, n = 120) {
  const a = []
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2, t1 = ((i + 1) / n) * Math.PI * 2
    a.push(r * Math.cos(t0), y, -r * Math.sin(t0), r * Math.cos(t1), y, -r * Math.sin(t1))
  }
  return a
}

/** Прямокутний стіл: сітка кожні 25 мм від початку координат (передній лівий кут), рамка, об'єм, осі */
function stageRect() {
  const SX = B.w / 2, SZ = B.d / 2, H = B.h
  const minor = [], major = []
  for (let i = 1; i * 25 < B.w - 1; i++) { const v = -SX + i * 25; (i % 2 ? minor : major).push(v, 0, -SZ, v, 0, SZ) }
  for (let i = 1; i * 25 < B.d - 1; i++) { const v = SZ - i * 25; (i % 2 ? minor : major).push(-SX, 0, v, SX, 0, v) }
  fx.stage.add(segments(minor, lineMat(0xffffff, 0.035)))
  fx.stage.add(segments(major, lineMat(0xffffff, 0.07)))
  fx.stage.add(segments([-SX, 0, -SZ, SX, 0, -SZ, SX, 0, -SZ, SX, 0, SZ, SX, 0, SZ, -SX, 0, SZ, -SX, 0, SZ, -SX, 0, -SZ], lineMat(0xffffff, 0.16)))
  const box = []
  for (const [x, z] of [[-SX, -SZ], [SX, -SZ], [SX, SZ], [-SX, SZ]]) box.push(x, 0, z, x, H, z)
  box.push(-SX, H, -SZ, SX, H, -SZ, SX, H, -SZ, SX, H, SZ, SX, H, SZ, -SX, H, SZ, -SX, H, SZ, -SX, H, -SZ)
  fx.idle.add(segments(box, lineMat(0xffffff, 0.06)))
  axes(-SX, SZ, Math.min(70, B.w * 0.2))
}

/**
 * Круглий стіл (дельта, polar): сітка кожні 25 мм, обрізана колом, яскравіший край, циліндр об'єму.
 * У дельти — три колони на кутах веж Klipper (A 210°, B 330°, C 90°). Початок координат — центр.
 */
function stageRound() {
  const R = B.r, H = B.h
  const minor = [], major = []
  for (let k = 1; k * 25 < R - 1; k++) {
    for (const v of [k * 25, -k * 25]) {
      const half = Math.sqrt(R * R - v * v), arr = k % 2 ? minor : major
      arr.push(v, 0, -half, v, 0, half, -half, 0, v, half, 0, v)
    }
  }
  major.push(0, 0, -R, 0, 0, R, -R, 0, 0, R, 0, 0)
  fx.stage.add(segments(minor, lineMat(0xffffff, 0.035)))
  fx.stage.add(segments(major, lineMat(0xffffff, 0.07)))
  fx.stage.add(segments(circle(R, 0), lineMat(0xffffff, 0.16)))
  const vol = []
  if (B.kin === 'delta' || B.kin === 'rotary_delta') {
    // Дельта: три лінії піднімаються з краю круглого столу (кути веж Klipper) і звужуються конусом
    // до меншого трикутника вгорі
    const at = (deg, r) => { const t = (deg * Math.PI) / 180; return [r * Math.cos(t), -r * Math.sin(t)] }
    const TOP = 0.42
    ;[210, 330, 90].forEach((deg, k, all) => {
      const [x, z] = at(deg, R), [tx, tz] = at(deg, R * TOP), [nx, nz] = at(all[(k + 1) % 3], R * TOP)
      vol.push(x, 0, z, tx, H, tz, tx, H, tz, nx, H, nz)
    })
  } else {
    // Polar: циліндр над столом
    vol.push(...circle(R, H, 96))
    for (const deg of [0, 90, 180, 270]) { const t = (deg * Math.PI) / 180, x = R * Math.cos(t), z = -R * Math.sin(t); vol.push(x, 0, z, x, H, z) }
  }
  fx.idle.add(segments(vol, lineMat(0xffffff, 0.06)))
  axes(0, 0, Math.min(70, R * 0.4))
}

/** Осі від початку координат: X — кораловий, Y — крижаний; лише назви, без розмірів */
function axes(x0, z0, A) {
  fx.idle.add(segments([x0, 0.5, z0, x0 + A, 0.5, z0, x0 + A, 0.5, z0, x0 + A - 7, 0.5, z0 - 4, x0 + A, 0.5, z0, x0 + A - 7, 0.5, z0 + 4], lineMat(CORAL, 0.9)))
  fx.idle.add(segments([x0, 0.5, z0, x0, 0.5, z0 - A, x0, 0.5, z0 - A, x0 - 4, 0.5, z0 - A + 7, x0, 0.5, z0 - A, x0 + 4, 0.5, z0 - A + 7], lineMat(ICE, 0.9)))
  fx.idle.add(label('X', '#ff6b5a', 16, x0 + A + 12, 2, z0))
  fx.idle.add(label('Y', '#7cc7ff', 16, x0, 2, z0 - A - 12))
}

function makeStage() {
  fx.stage = new THREE.Group(); fx.idle = new THREE.Group()
  if (B.round) stageRound(); else stageRect()
  scene.add(fx.stage, fx.idle)

  // Світіння: гало на висоті поточного шару, тепле відбиття від столу, коралова «аура» ліній поточного шару
  const tex = radialTexture()
  fx.halo = glowPlane(tex); fx.bedGlow = glowPlane(tex)
  fx.bedGlow.position.y = 0.3
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
  fx.glowLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: glowColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
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
  const cx = b ? (b.x0 + b.x1) / 2 - B.cx : 0, cz = b ? -((b.y0 + b.y1) / 2 - B.cy) : 0
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
  // Мобільне «Керування» (MobileControl, той самий MOBILE_QUERY):
  //  • телефон — картки стовпчиком знизу, модель піднята у верхню третину й трохи віддалена;
  //  • ≥640 px (розгорнутий Fold) — праворуч панель ~380 px, модель у центрі лівої частини над карткою друку.
  const W = innerWidth, H = innerHeight
  const mobile = typeof matchMedia === 'function' && matchMedia(MOBILE_QUERY).matches
  if (mobile && W >= 640) {
    const left = W - 380 - 32                       // ширина лівої частини
    cam.setViewOffset(W, H, Math.round((W - left) / 2 - 16), Math.round(H * 0.08), W, H)
    cam.zoom = Math.min(0.8, (left / H) / 0.62)
  } else if (mobile) {
    cam.setViewOffset(W, H, 0, Math.round(H * 0.2), W, H)
    cam.zoom = Math.min(0.78, cam.aspect / 0.62)
  } else {
    cam.clearViewOffset()
    cam.zoom = 1
  }
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

/**
 * Тема змінилась: T0 (надрукована частина однієї голови) — від фірмового кольору до світлого акценту,
 * світіння поточного шару — акцент. Осі X/Y лишаються семантичними (червона X, блакитна Y).
 */
function onTheme(e) {
  const d = e.detail || {}, acc = hexToRgb(d.accent), br = hexToRgb(d.brand)
  if (!acc || !br) return
  const voron = d.accent === '#ff6b5a' && d.brand === '#f03a2e'
  TOOL_COLORS[0] = voron ? T0_VORON : [br.map(v => v / 255), acc.map(v => (v + (255 - v) * 0.45) / 255)]
  glowColor = voron ? CORAL : new THREE.Color(d.accent).getHex()
  for (const m of [fx.halo, fx.bedGlow, fx.glowLines]) m?.material?.color.set(glowColor)
  if (colAttr && model.P) repaint(0, model.N, painted)
  if (renderer) kick()
}
addEventListener('vyron-theme', onTheme)
onTheme({ detail: useDesignStore().d })   // тема вже застосована до монтування сцени

onBeforeUnmount(() => {
  removeEventListener('vyron-theme', onTheme)
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

/** Новий стіл: перебудувати каркас і координати моделі */
function rebuildStage() {
  B = printer.bed
  if (!scene) return
  for (const g of [fx.stage, fx.idle, fx.halo, fx.bedGlow, fx.glowLines]) {
    if (!g) continue
    scene.remove(g)
    g.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose() })
  }
  fx.mats = []
  makeStage()
  build()
}
watch(() => printer.bed, rebuildStage)
watch(() => printer.modelVersion, build)
watch(() => printer.done, paintTo)
watch(printing, () => { updateGlow(); kick() })
watch(() => Math.round((printer.bedTemp ?? 0) / 5), () => { updateGlow(); kick() })
watch(() => ui.view, kick)
</script>

<template>
  <canvas ref="cv" class="bg3d"></canvas>
  <!-- Скидання ракурсу: з'являється, коли камеру зрушено; подвійний клік/тап по сцені теж працює -->
  <Transition name="rv">
    <button v-if="camMoved && ui.view === 'main'" type="button" class="rv glass" :title="t('view.reset')" :aria-label="t('view.reset')" @click="orbit.reset()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v3.7h3.7" /><circle cx="12" cy="12" r="2.2" /></svg>
    </button>
  </Transition>
</template>

<style scoped>
.bg3d{position:fixed;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none}
.bg3d:active{cursor:grabbing}
/* Правий нижній кут: на 1440/1024/800 там вільно — не перекриває модель, джог, «%» і телеметрію */
.rv{position:fixed;right:32px;bottom:24px;z-index:4;width:42px;height:42px;padding:0;border-radius:50%;display:grid;place-items:center;color:var(--ink);cursor:pointer;
  transition:transform var(--t-spring) var(--spring),color var(--t-fast) var(--ease-out),box-shadow var(--t-mid) var(--ease-out)}
.rv svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.rv:hover{color:var(--coral);box-shadow:var(--glass-shadow),0 0 18px -4px rgba(var(--accent-rgb),.55)}
.rv:active{transform:scale(.92)}
.rv:focus-visible{outline:2px solid var(--coral);outline-offset:3px}
.rv-enter-active{transition:transform var(--t-spring) var(--spring),opacity var(--t-fast) var(--ease-out)}
.rv-leave-active{transition:transform .2s var(--ease-out),opacity .16s var(--ease-out)}
.rv-enter-from,.rv-leave-to{opacity:0;transform:scale(.6)}
@media(max-width:900px){.rv{right:16px;bottom:16px}}
/* Вузькі екрани: телеметрія внизу праворуч — кнопка у вільному верхньому куті під шапкою */
@media(max-width:700px){.rv{bottom:auto;top:calc(var(--hb,72px) + 12px)}}
</style>

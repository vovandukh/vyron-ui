<script setup>
// 3D-поверхня карти столу. Рендериться лише поки вкладка активна.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { useOrbitCamera } from '../../composables/useOrbitCamera'
import { meshInside } from '@vyron/shared/klipper/bed'

const props = defineProps({
  matrix: { type: Array, default: null },
  lim: { type: Number, default: 0.02 },
  round: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
})

const W = 240
const wrap = ref(null), cv = ref(null)
const orbit = useOrbitCamera(cv, { rotX: 0.6, rotY: 0.6, dist: 380, speed: 0.008, minX: 0.1, maxX: 1.5 })
const ORIGIN = { x: 0, y: 0, z: 0 }

let renderer, scene, cam, obj = null, raf = 0, ro = null, w = 0, h = 0

function resize() {
  const c = wrap.value
  if (!c || !c.clientWidth || !c.clientHeight) return
  w = c.clientWidth; h = c.clientHeight
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
  renderer.setSize(w, h, false)
  cam.aspect = w / h
  cam.updateProjectionMatrix()
  kick()
}

// Рендер на вимогу: поки камера нерухома і дані не змінились, цикл спить.
let dirty = true
function kick() { dirty = true; if (!raf && renderer) raf = requestAnimationFrame(loop) }
orbit.wake = kick
function loop(now) {
  raf = 0
  const moving = orbit.update(now)
  if (props.active && w && h && (moving || dirty)) { orbit.place(cam, ORIGIN); renderer.render(scene, cam); dirty = false }
  if (moving && props.active) raf = requestAnimationFrame(loop)
}

function dispose() {
  if (!obj) return
  scene.remove(obj)
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose()
    if (o.material) [].concat(o.material).forEach(m => m.dispose())
  })
  obj = null
}

/** Поверхня з кольором від синього (нижче) до червоного (вище); висота перебільшена в 40/lim разів. */
/** Коло радіусом r (відрізками) — край круглого столу */
function ring(r, n = 96) {
  const a = []
  for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI * 2; a.push(r * Math.cos(t), 0, r * Math.sin(t)) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3))
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x5a3a3c }))
}

function surface(mx, lim, round) {
  dispose()
  if (!mx) return
  const R = mx.length, C = mx[0].length, k = 40 / lim, pos = [], col = [], idx = []
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const v = mx[r][c], t = v / lim, a = Math.abs(t), to = t < 0 ? [0.31, 0.55, 1] : [0.94, 0.23, 0.18]
    pos.push((c / (C - 1) - 0.5) * W, v * k, -(r / (R - 1) - 0.5) * W)
    col.push(0.36 + (to[0] - 0.36) * a, 0.38 + (to[1] - 0.38) * a, 0.41 + (to[2] - 0.41) * a)
    if (r < R - 1 && c < C - 1) {
      const i = r * C + c
      // Круглий стіл: лише трикутники, усі вершини яких усередині кола (точки поза ним Klipper не міряє)
      // Кути клітинки в порядку обходу: (r,c) → (r+1,c) → (r+1,c+1) → (r,c+1)
      const q = [[i, r, c], [i + C, r + 1, c], [i + C + 1, r + 1, c + 1], [i + 1, r, c + 1]]
        .filter(([, rr, cc]) => !round || meshInside(rr, cc, R, C)).map(([k]) => k)
      if (q.length === 4) idx.push(i, i + C, i + 1, i + 1, i + C, i + C + 1)
      else if (q.length === 3) idx.push(...q)    // край кола — один трикутник із трьох виміряних точок
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  obj = new THREE.Group()
  obj.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })))
  obj.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.12 })))
  obj.add(round ? ring(W / 2) : new THREE.GridHelper(W, C - 1, 0x3a2a2c, 0x3a2a2c))
  scene.add(obj)
  kick()
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ canvas: cv.value, antialias: true, alpha: true })
  scene = new THREE.Scene()
  cam = new THREE.PerspectiveCamera(40, 1, 1, 3000)
  scene.add(new THREE.AmbientLight(0xffffff, 0.65))
  const light = new THREE.DirectionalLight(0xffffff, 0.8)
  light.position.set(-100, 300, 200)
  scene.add(light)
  ro = new ResizeObserver(resize)
  ro.observe(wrap.value)
  resize()
  surface(props.matrix, props.lim, props.round)
  kick()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  dispose()
  renderer?.dispose()
})

watch(() => [props.matrix, props.lim, props.round], () => surface(props.matrix, props.lim, props.round))
watch(() => props.active, a => { if (a) resize() })
</script>

<template>
  <div ref="wrap" class="m3"><canvas ref="cv"></canvas></div>
</template>

<style scoped>
.m3{position:relative;min-height:280px;background:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.04),transparent 70%),var(--surface);border:1px solid var(--hair);border-radius:var(--r-lg);overflow:hidden}
@media(max-width:900px){.m3{min-height:180px}}
@media(max-width:700px){.m3{min-height:260px}}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none}
</style>

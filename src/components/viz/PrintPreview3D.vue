<script setup>
// Повноекранний 3D-перегляд друку (Three.js) на фоні інтерфейсу.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { usePrinterStore } from '../../stores/printerStore'
import { useOrbitCamera } from '../../composables/useOrbitCamera'
import { model, BED } from '../../services/gcodeModel'

const GRAY = [0.24, 0.26, 0.29], A = [0.93, 0.28, 0.23], B = [1, 0.68, 0.62]
// Яскравість парних шарів відносно непарних: чергування робить межі шарів помітними
// (раніше було 0.8 — тонкі шари зливались у суцільну масу).
const LAY_DIM = 0.62
const shade = lay => (lay & 1 ? 1 : LAY_DIM)

const printer = usePrinterStore()
const cv = ref(null)
const orbit = useOrbitCamera(cv, { rotX: 0.45, rotY: 0.7, dist: 650, speed: 0.007, minX: -0.1, maxX: 1.5, wheel: true, minDist: 60, maxDist: 1600 })

let renderer, scene, cam, dot, lines = null, colAttr = null, painted = 0, raf = 0
const target = new THREE.Vector3(0, 35, 0)

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
  renderer.setSize(innerWidth, innerHeight, false)
  cam.aspect = innerWidth / innerHeight
  cam.updateProjectionMatrix()
}

function loop() {
  orbit.place(cam, target)
  renderer.render(scene, cam)
  raf = requestAnimationFrame(loop)
}

function build() {
  if (lines) { scene.remove(lines); lines.geometry.dispose(); lines.material.dispose(); lines = null }
  const { P, N, Lay, zScale: zs } = model
  painted = 0
  if (!P) return
  const GR = [GRAY.map(v => v * LAY_DIM), GRAY]
  const pos = new Float32Array(N * 6), col = new Float32Array(N * 6)
  for (let i = 0; i < N; i++) {
    const o = i * 6
    // Z множиться на zScale (візуальний крок шарів, див. gcodeModel.js); X/Y без змін.
    pos.set([P[o] - BED[0] / 2, P[o + 2] * zs, -(P[o + 1] - BED[1] / 2), P[o + 3] - BED[0] / 2, P[o + 5] * zs, -(P[o + 4] - BED[1] / 2)], o)
    for (let k = 0; k < 6; k += 3) col.set(GR[Lay[i] & 1], o + k)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  colAttr = new THREE.BufferAttribute(col, 3)
  g.setAttribute('color', colAttr)
  lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }))
  scene.add(lines)
  const b = model.bounds
  if (b) {
    const h = model.zmax * zs
    target.set((b.x0 + b.x1) / 2 - BED[0] / 2, h / 2, -((b.y0 + b.y1) / 2 - BED[1] / 2))
    orbit.dist = Math.max(b.x1 - b.x0, b.y1 - b.y0, h) * 2.1 + 25
  }
  paintTo(printer.done)
}

/** Фарбує надруковані сегменти градієнтом за висотою, решту — сірим (з чергуванням шарів). */
function paint(i, on) {
  const z = model.P[i * 6 + 2] / model.zmax, o = i * 6, k = shade(model.Lay[i]), a = colAttr.array
  for (let j = 0; j < 2; j++) {
    const q = o + j * 3
    if (on) {
      a[q] = (A[0] + (B[0] - A[0]) * z) * k
      a[q + 1] = (A[1] + (B[1] - A[1]) * z) * k
      a[q + 2] = (A[2] + (B[2] - A[2]) * z) * k
    } else { a[q] = GRAY[0] * k; a[q + 1] = GRAY[1] * k; a[q + 2] = GRAY[2] * k }
  }
}

function paintTo(n) {
  if (!colAttr || !model.P) return
  n = Math.min(n, model.N)
  if (n > painted) for (let i = painted; i < n; i++) paint(i, true)
  else for (let i = n; i < painted; i++) paint(i, false)
  if (n !== painted) { painted = n; colAttr.needsUpdate = true }
}

function moveDot(p) {
  if (!dot) return
  if (!p) { dot.visible = false; return }
  dot.visible = true
  // Та сама шкала Z, що й у моделі, — сопло стоїть точно на поточному шарі.
  dot.position.set(p[0] - BED[0] / 2, p[2] * model.zScale, -(p[1] - BED[1] / 2))
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ canvas: cv.value, antialias: true, alpha: true })
  scene = new THREE.Scene()
  cam = new THREE.PerspectiveCamera(40, 1, 1, 5000)
  dot = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 12), new THREE.MeshBasicMaterial({ color: 0xf03a2e }))
  dot.visible = false
  scene.add(dot)
  addEventListener('resize', resize)
  resize()
  build()
  loop()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  removeEventListener('resize', resize)
  renderer?.dispose()
})

watch(() => printer.modelVersion, build)
watch(() => printer.done, paintTo)
watch(() => printer.position, moveDot)
</script>

<template>
  <canvas ref="cv" class="bg3d"></canvas>
</template>

<style scoped>
.bg3d{position:fixed;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none}
</style>

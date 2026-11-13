import { onMounted, onBeforeUnmount } from 'vue'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/**
 * Орбітальна камера для canvas: перетягування обертає, колесо (опційно) змінює відстань.
 * Стан — звичайний (нереактивний) об'єкт, його читає цикл рендерингу.
 */
export function useOrbitCamera(elRef, opts) {
  const o = { speed: 0.007, minX: -0.1, maxX: 1.5, wheel: false, minDist: 60, maxDist: 1600, ...opts }
  const s = { rotX: o.rotX, rotY: o.rotY, dist: o.dist }
  let drag = null, el = null

  const down = e => { drag = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId) }
  const up = () => { drag = null }
  const move = e => {
    if (!drag) return
    s.rotY -= (e.clientX - drag[0]) * o.speed
    s.rotX = clamp(s.rotX + (e.clientY - drag[1]) * o.speed, o.minX, o.maxX)
    drag = [e.clientX, e.clientY]
  }
  const wheel = e => { e.preventDefault(); s.dist = clamp(s.dist * (1 + e.deltaY * 0.001), o.minDist, o.maxDist) }

  /** Ставить камеру на орбіту навколо target ({x,y,z}). */
  s.place = (cam, t) => {
    cam.position.set(
      t.x + s.dist * Math.cos(s.rotX) * Math.sin(s.rotY),
      t.y + s.dist * Math.sin(s.rotX),
      t.z + s.dist * Math.cos(s.rotX) * Math.cos(s.rotY)
    )
    cam.lookAt(t.x, t.y, t.z)
  }

  onMounted(() => {
    el = elRef.value
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('pointermove', move)
    if (o.wheel) el.addEventListener('wheel', wheel, { passive: false })
  })
  onBeforeUnmount(() => {
    if (!el) return
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('wheel', wheel)
  })

  return s
}

// Модель поточного друку. Великі типізовані масиви навмисно тримаються поза
// реактивним станом Vue; стор зберігає лише лічильник версії та індекс прогресу.

export const BED = [350, 350]

export const model = {
  P: null,       // Float32Array сегментів
  F: null,       // байтові зміщення кінця кожного сегмента
  N: 0,
  Lay: null,     // індекс шару кожного сегмента
  layers: [],    // відсортовані унікальні висоти шарів (×100)
  zmax: 1,
  bounds: null   // {x0,x1,y0,y1}
}

export function loadModel(P, F) {
  const N = F.length
  let zmax = 0.001, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  const zs = new Set()
  for (let i = 0; i < N; i++) {
    const o = i * 6
    zmax = Math.max(zmax, P[o + 2], P[o + 5])
    zs.add(Math.round(P[o + 5] * 100))
    x0 = Math.min(x0, P[o], P[o + 3]); x1 = Math.max(x1, P[o], P[o + 3])
    y0 = Math.min(y0, P[o + 1], P[o + 4]); y1 = Math.max(y1, P[o + 1], P[o + 4])
  }
  const layers = [...zs].sort((a, b) => a - b)
  const map = new Map(layers.map((z, i) => [z, i]))
  const Lay = new Uint16Array(N)
  for (let i = 0; i < N; i++) Lay[i] = map.get(Math.round(P[i * 6 + 5] * 100))
  Object.assign(model, { P, F, N, Lay, layers, zmax, bounds: N ? { x0, x1, y0, y1 } : null })
}

/** Кількість сегментів, надрукованих до байтового зміщення pos. */
export function indexForPos(pos) {
  const F = model.F
  if (!F) return 0
  let lo = 0, hi = model.N
  while (lo < hi) { const m = (lo + hi) >> 1; if (F[m] <= pos) lo = m + 1; else hi = m }
  return lo
}

export function segEnd(i) {
  const o = i * 6, P = model.P
  return [P[o + 3], P[o + 4], P[o + 5]]
}

/** «шар / всього», обчислений з моделі, коли Klipper не повідомляє номер шару. */
export function layerLabel(done) {
  if (!model.P || !model.N || !done) return '–'
  const z = Math.round(model.P[(done - 1) * 6 + 5] * 100), lz = model.layers
  let lo = 0, hi = lz.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (lz[m] < z) lo = m + 1; else hi = m }
  return lo + 1 + ' / ' + lz.length
}

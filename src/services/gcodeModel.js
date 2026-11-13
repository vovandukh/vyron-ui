// Модель поточного друку. Великі типізовані масиви навмисно тримаються поза
// реактивним станом Vue; стор зберігає лише лічильник версії та індекс прогресу.

export const BED = [350, 350]

// Візуальний крок шарів: тонкі шари (0.2 мм) на прев'ю зливаються, тому вісь Z помірно
// розтягується так, щоб видимий крок був ~LAYER_PITCH мм, але не більше ніж у Z_SCALE_MAX раз —
// пропорції моделі лишаються впізнаваними. Для шарів ≥ LAYER_PITCH масштаб = 1.
// Підібрано на реальних моделях (0.2 мм, 15–100 шарів): ×1.6 — шари читаються окремо,
// ×2+ — модель помітно витягується. Разом із чергуванням яскравості в PrintPreview3D.
const LAYER_PITCH = 0.5
const Z_SCALE_MAX = 1.6

export const model = {
  P: null,       // Float32Array сегментів
  F: null,       // байтові зміщення кінця кожного сегмента
  N: 0,
  Lay: null,     // індекс шару кожного сегмента
  T: null,       // інструмент (T0…TN) кожного сегмента
  layers: [],    // відсортовані унікальні висоти шарів (×100)
  zmax: 1,
  zScale: 1,     // візуальний масштаб осі Z для 3D-прев'ю
  layerHeight: 0,
  bounds: null   // {x0,x1,y0,y1}
}

/** Медіанна висота шару (мм) за відсортованими висотами ×100. */
function medianLayerHeight(layers) {
  const d = []
  for (let i = 1; i < layers.length; i++) {
    const h = (layers[i] - layers[i - 1]) / 100
    if (h >= 0.02 && h <= 2) d.push(h)
  }
  if (!d.length) return 0
  d.sort((a, b) => a - b)
  return d[d.length >> 1]
}

/**
 * Межі XY для кадрування камери. Перший шар не враховується (якщо шарів ≥ 3): там лежать
 * purge-лінія на краю столу, skirt і brim, які інакше зсувають центр і зменшують деталь у кадрі.
 */
function frameBounds(P, N, Lay, nLayers) {
  const skipFirst = nLayers >= 3
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  for (let i = 0; i < N; i++) {
    if (skipFirst && Lay[i] === 0) continue
    const o = i * 6
    x0 = Math.min(x0, P[o], P[o + 3]); x1 = Math.max(x1, P[o], P[o + 3])
    y0 = Math.min(y0, P[o + 1], P[o + 4]); y1 = Math.max(y1, P[o + 1], P[o + 4])
  }
  return x1 >= x0 ? { x0, x1, y0, y1 } : null
}

/** P, F — сегменти й байтові зміщення; T — інструмент кожного сегмента (необов'язково, за замовчуванням T0). */
export function loadModel(P, F, T) {
  const N = F.length
  let zmax = 0.001
  const zs = new Set()
  for (let i = 0; i < N; i++) {
    const o = i * 6
    zmax = Math.max(zmax, P[o + 2], P[o + 5])
    zs.add(Math.round(P[o + 5] * 100))
  }
  const layers = [...zs].sort((a, b) => a - b)
  const map = new Map(layers.map((z, i) => [z, i]))
  const Lay = new Uint16Array(N)
  for (let i = 0; i < N; i++) Lay[i] = map.get(Math.round(P[i * 6 + 5] * 100))
  const layerHeight = medianLayerHeight(layers)
  const zScale = layerHeight ? Math.min(Z_SCALE_MAX, Math.max(1, LAYER_PITCH / layerHeight)) : 1
  const bounds = N ? frameBounds(P, N, Lay, layers.length) || frameBounds(P, N, Lay, 0) : null
  Object.assign(model, { P, F, N, Lay, T: T && T.length === N ? T : new Uint8Array(N), layers, zmax, zScale, layerHeight, bounds })
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

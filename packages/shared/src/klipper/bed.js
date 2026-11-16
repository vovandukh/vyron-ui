// Форма й розміри робочої області — з самого Klipper, без зашитого «Voron 350».
//
// Klipper віддає межі осей у статусі toolhead (axis_minimum / axis_maximum: [x, y, z, e]).
// Кінематика (printer.kinematics у printer.cfg) каже, чи стіл круглий: у дельти й polar
// межі X/Y — це квадрат навколо кола радіусом print_radius, центр у (0, 0).

const ROUND = new Set(['delta', 'rotary_delta', 'polar'])

/** Стіл за замовчуванням, поки Klipper не відповів (і в демо): прямокутний 350 × 350, висота 330. */
export const DEFAULT_BED = Object.freeze({ round: false, x0: 0, x1: 350, y0: 0, y1: 350, cx: 175, cy: 175, w: 350, d: 350, r: 175, h: 330, kin: '' })

/**
 * @param {string} kinematics printer.kinematics з налаштувань
 * @param {{axis_minimum?: number[], axis_maximum?: number[]}} toolhead статус toolhead
 * @returns {typeof DEFAULT_BED | null} null — межі ще невідомі
 */
export function bedShape(kinematics, toolhead) {
  const lo = toolhead && toolhead.axis_minimum, hi = toolhead && toolhead.axis_maximum
  if (!Array.isArray(lo) || !Array.isArray(hi)) return null
  const [x0, y0] = lo.map(Number), [x1, y1, zMax] = hi.map(Number)
  if (![x0, x1, y0, y1].every(Number.isFinite) || x1 - x0 < 10 || y1 - y0 < 10) return null
  const kin = String(kinematics || '').toLowerCase()
  const w = x1 - x0, d = y1 - y0
  return {
    round: ROUND.has(kin),
    x0, x1, y0, y1, w, d,
    cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
    r: Math.min(w, d) / 2,
    // Висота для каркаса: межа Z з Klipper; неправдоподібну (0 або тисячі мм) замінюємо пропорційною
    h: Number.isFinite(zMax) && zMax > 20 && zMax < 3 * Math.max(w, d) ? zMax : Math.max(w, d) * 0.9,
    kin
  }
}

/** Ключ для порівняння: щоб сцену перебудовувати лише тоді, коли стіл справді змінився. */
export const bedKey = b => (b ? [b.round ? 'o' : 'r', b.x0, b.x1, b.y0, b.y1, Math.round(b.h)].join(':') : '')

/**
 * Точка (рядок, стовпець) карти круглого столу всередині кола?
 * Карта Klipper для круглого столу — квадратна сітка навколо кола; точки поза колом Klipper не міряє,
 * а заповнює продовженням сусідніх значень, тож показувати й рахувати їх не можна.
 */
export function meshInside(r, c, rows, cols) {
  const u = cols > 1 ? (c / (cols - 1)) * 2 - 1 : 0
  const v = rows > 1 ? (r / (rows - 1)) * 2 - 1 : 0
  return u * u + v * v <= 1 + 1e-6
}

// Логотип Vyron — контурна V (подвійна лінія) і всередині неї суцільний трикутник-«D» з круглою
// чашею праворуч і трикутним вирізом. V — Vyron, D — ініціал автора.
// Геометрія точна: грані D і вирізу паралельні рукам V (нахил 25/46), чаша D — дуга, що дотикається
// обох граней. Сітка 64×48, знак по центру квадрата VIEWBOX. Одна геометрія для шапки, екрана й favicon.

export const VIEWBOX = '-3 -11 70 70'

/** Контур V (малюється обведенням, без заливки) */
export const OUTLINE = 'M1 1H10L32 41.5 54 1H63L38 47H26Z'
/** Трикутник-«D» з чашею та вирізом (заливка, fill-rule evenodd) */
export const MARK = 'M16 1H40.4A4.5 4.5 0 0 1 44.37 7.67L32 30.4Z M27 6.5H37L32 15.7Z'
/** Товщина лінії контуру V */
export const OUTLINE_W = 3

/** SVG-рядок логотипа (favicon, data URI). color — фірмовий колір. */
export function logoSvg(color = '#f03a2e') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">` +
    `<path d="${OUTLINE}" fill="none" stroke="${color}" stroke-width="${OUTLINE_W + 1}" stroke-linejoin="miter"/>` +
    `<path d="${MARK}" fill="${color}" fill-rule="evenodd"/></svg>`
}

export const logoDataUri = color => 'data:image/svg+xml,' + encodeURIComponent(logoSvg(color))

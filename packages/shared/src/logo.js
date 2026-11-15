// Логотип Vyron — суцільна V і всередині неї трикутник-«D» з круглою чашею праворуч і вдавленим
// трикутним вирізом. V — Vyron, D — ініціал автора.
// Геометрія точна: грані D і вирізу паралельні рукам V (нахил 25/46), чаша D — дуга, що дотикається
// обох граней. Сітка 64×48, знак по центру квадрата VIEWBOX. Одна геометрія для шапки, екрана й favicon.

export const VIEWBOX = '-3 -11 70 70'

/** V — суцільна смуга */
export const BAND = 'M1 1H10L32 41.5 54 1H63L38 47H26Z'
/** «D» без вирізу */
export const D = 'M16 1H40.4A4.5 4.5 0 0 1 44.37 7.67L32 30.4Z'
/** Виріз у «D» — замальований темнішим відтінком, ніби вдавлений */
export const HOLE = 'M27 6.5H37L32 15.7Z'

let seq = 0

/**
 * SVG-рядок логотипа. color — будь-який CSS-колір, зокрема 'var(--brand)' (для вбудованого SVG).
 * fx — легкі тіні й об'єм (для шапки й екрана); без fx — пласка версія для favicon.
 */
export function logoSvg(color = '#f03a2e', { fx = false } = {}) {
  const f = `style="fill:${color}"`
  if (!fx) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">` +
      `<path d="${BAND}" ${f}/><path d="${D}" ${f}/><path d="${HOLE}" fill="#000" fill-opacity=".38"/></svg>`
  }
  const u = 'vy' + (++seq)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" style="overflow:visible;display:block;width:100%;height:100%">` +
    '<defs>' +
    // Тінь: м'яка, трохи вниз — знак ледь «відривається» від фону
    `<filter id="${u}s" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#000" flood-opacity=".45"/></filter>` +
    // Об'єм V: низ темніший
    `<linearGradient id="${u}b" x1="0" y1="1" x2="0" y2="47" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>` +
    // Відблиск у центрі D
    `<radialGradient id="${u}h" cx="32" cy="12" r="18" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    // Вдавлений виріз: зверху темніше (внутрішня тінь), донизу світліше
    `<linearGradient id="${u}v" x1="0" y1="6.5" x2="0" y2="15.7" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>` +
    '</defs>' +
    `<g filter="url(#${u}s)"><path d="${BAND}" ${f}/><path d="${BAND}" fill="url(#${u}b)"/></g>` +
    `<g filter="url(#${u}s)"><path d="${D}" ${f}/><path d="${D}" fill="url(#${u}h)"/></g>` +
    `<path d="${HOLE}" fill="url(#${u}v)"/>` +
    '</svg>'
}

export const logoDataUri = color => 'data:image/svg+xml,' + encodeURIComponent(logoSvg(color))

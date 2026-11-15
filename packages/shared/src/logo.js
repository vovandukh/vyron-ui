// Логотип Vyron — монограма VD: сам знак має силует літери D (пряма спинка, кругла дуга),
// а в ньому вирізана V (Vyron і ініціал автора). Одна геометрія для шапки (компонент VyronLogo),
// favicon і превʼю дизайну. Сітка 32×32; V трохи лівіше центру — оптично врівноважує масу дуги.

/** Силует D */
export const SHAPE = 'M7 4h8.5a12 12 0 0 1 0 24H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z'
/** Літера V — одна лінія з круглими кінцями */
export const V = 'M9.6 11 14.6 21.2 19.6 11'

/** SVG-рядок логотипа: color — силует, ink — літера. Для favicon (data URI). */
export function logoSvg(color = '#f03a2e', ink = '#ffffff') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<path d="${SHAPE}" fill="${color}"/>` +
    `<path d="${V}" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

export const logoDataUri = (color, ink) => 'data:image/svg+xml,' + encodeURIComponent(logoSvg(color, ink))

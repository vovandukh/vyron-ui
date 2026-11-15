// Логотип Vyron: заокруглений шестикутник (як шестикутна сітка фону інтерфейсу) з вирізаною літерою V.
// Одна геометрія для шапки (компонент VyronLogo), favicon і превʼю дизайну. Сітка 32×32.

/** Шестикутник «гострим кінцем догори»; заокруглення кутів — обведенням того самого кольору з round-з'єднаннями. */
export const HEX = '16,3 27.26,9.5 27.26,22.5 16,29 4.74,22.5 4.74,9.5'
/** Літера V — одна лінія з круглими кінцями */
export const V = 'M10.6 11.6 16 21 21.4 11.6'

/** SVG-рядок логотипа: color — шестикутник, ink — літера. Для favicon (data URI). */
export function logoSvg(color = '#f03a2e', ink = '#ffffff') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<polygon points="${HEX}" fill="${color}" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="${V}" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

export const logoDataUri = (color, ink) => 'data:image/svg+xml,' + encodeURIComponent(logoSvg(color, ink))

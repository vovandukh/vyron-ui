/** Тривалість у секундах → «2 г 5 хв» / «5 хв» (через переданий t). */
export function fmtDuration(sec, t) {
  const x = Math.max(0, Math.round(sec || 0))
  const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60)
  return h ? t('fmt.hm', { h, m }) : t('fmt.m', { m })
}

export const fmtTemp = v => (v == null ? '–' : Math.round(v) + '°')
export const fmtPct = v => (v == null ? '–' : Math.round(v * 100) + '%')

/**
 * Теплова шкала для підсвічування: ≤35° — крижаний (--ice), ≥180° — кораловий (--coral),
 * між ними через теплий бурштин (пряме змішування крижаного з кораловим дає брудно-рожевий).
 * Повертає 'r,g,b' — для rgba(var(--heat), α).
 */
const HEAT_STOPS = [[0, [124, 199, 255]], [0.55, [255, 184, 108]], [1, [255, 107, 90]]]
export function heatRgb(temp, cold = 35, hot = 180) {
  const k = Math.min(1, Math.max(0, ((temp ?? cold) - cold) / (hot - cold)))
  let i = 0
  while (i < HEAT_STOPS.length - 2 && k > HEAT_STOPS[i + 1][0]) i++
  const [k0, a] = HEAT_STOPS[i], [k1, b] = HEAT_STOPS[i + 1]
  const f = (k - k0) / (k1 - k0)
  return a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(',')
}

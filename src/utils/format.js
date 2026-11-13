/** Тривалість у секундах → «2 г 5 хв» / «5 хв» (через переданий t). */
export function fmtDuration(sec, t) {
  const x = Math.max(0, Math.round(sec || 0))
  const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60)
  return h ? t('fmt.hm', { h, m }) : t('fmt.m', { m })
}

export const fmtTemp = v => (v == null ? '–' : Math.round(v) + '°')
export const fmtPct = v => (v == null ? '–' : Math.round(v * 100) + '%')

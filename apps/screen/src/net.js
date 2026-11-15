// Мережа хоста з machine.system_info: інтерфейси та їхні IPv4. Wi‑Fi — інтерфейси wl*.

/** [{ name, ip, wifi }] без loopback і без інтерфейсів без адреси (крім Wi‑Fi — його показуємо завжди) */
export function interfaces(info) {
  const n = (info && info.network) || {}
  return Object.keys(n).filter(k => k !== 'lo').map(k => ({
    name: k,
    wifi: /^wl/.test(k),
    ip: ((n[k].ip_addresses || []).find(a => a.family === 'ipv4') || {}).address || ''
  })).filter(i => i.ip || i.wifi)
}

/** Коротко для рядка «Wi‑Fi» у налаштуваннях: IP бездротового інтерфейсу або «не підключено» */
export function wlanSummary(info) {
  const w = interfaces(info).find(i => i.wifi)
  return w ? w.ip || '—' : ''
}

/** Рядок відповіді макроса WIFI_SCAN: «SSID:SIGNAL:SECURITY» (двокрапки в SSID екрановані \:) */
export function parseScanLine(line) {
  const m = String(line).replace(/^\/\/\s*/, '').trim().match(/^((?:\\.|[^:\\])*):(\d{1,3}):(.*)$/)
  return m ? { ssid: m[1].replace(/\\(.)/g, '$1'), sig: +m[2], sec: m[3].trim() } : null
}

/** Символи, які не можна передати в макрос WIFI_CONNECT (ламають лапки G-code) */
export const BAD_CHARS = /["'\\{}]/

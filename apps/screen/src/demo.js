// Демо для розробки (npm run dev:screen, ?demo): імітація друку й відповідей Moonraker без принтера.
// ?demo&state=idle|printing|paused|shutdown — потрібний стан одразу. Лише в dev-збірці.

export function startDemo({ merge, setKlippy }) {
  const q = new URLSearchParams(location.search)
  const want = q.get('state') || 'printing'
  if (want === 'shutdown') {
    setKlippy('shutdown', "Heater extruder not heating at expected rate\nSee the 'verify_heater' section in docs/Config_Reference.md\nfor the parameters that control this check.\nPrinter is shutdown")
    return
  }
  setKlippy('ready')
  const idle = want === 'idle'
  let p = idle ? 0 : 0.37, d = 2860
  const tick = () => {
    if (want === 'printing') { p = Math.min(1, p + 0.0004); d += 1 }
    merge({
      print_stats: idle ? { state: 'standby', filename: '' } : {
        state: want === 'paused' ? 'paused' : 'printing',
        filename: 'vyron_vase_0.2mm_PETG_2h40m.gcode',
        print_duration: d,
        info: { current_layer: Math.round(p * 412), total_layer: 412 }
      },
      display_status: { progress: p },
      extruder: { temperature: idle ? 24.6 : 239.8 + Math.random() * 0.4, target: idle ? 0 : 240 },
      heater_bed: { temperature: idle ? 23.9 : 79.9 + Math.random() * 0.2, target: idle ? 0 : 80 }
    })
  }
  tick()
  setInterval(tick, 1000)
}

const NETS = [
  ['Vyron Lab', 92, 'WPA2'], ['Kyivstar_5G', 74, 'WPA2 WPA3'], ['Workshop', 61, 'WPA2'],
  ['Guest', 48, ''], ['TP-Link_3F2A', 33, 'WPA2'], ['DIRECT-printer', 21, 'WPA2']
]
const wait = ms => new Promise(r => setTimeout(r, ms))
let db = {}

/** Імітація викликів Moonraker для сторінок налаштувань */
export async function demoCall(method, params, { emitGcode }) {
  await wait(150)
  switch (method) {
    case 'machine.system_info':
      return { system_info: {
        cpu_info: { model: 'ARMv8 (Allwinner H616)', cpu_count: 4, total_memory: 1009264, memory_units: 'kB' },
        distribution: { name: 'Armbian 23.08 bookworm' },
        network: { wlan0: { ip_addresses: [{ family: 'ipv4', address: '192.168.1.50' }] }, can0: { ip_addresses: [] } }
      } }
    case 'server.info': return { moonraker_version: 'v0.9.3-41-g3f9d2c1', klippy_state: 'ready' }
    case 'printer.info': return { software_version: 'v0.13.0-560-gaea1bcf', hostname: 'vyron-demo', state: 'ready' }
    case 'server.database.get_item': {
      const v = db[params.namespace + '/' + params.key]
      if (!v) throw new Error('Key not found')
      return { value: v }
    }
    case 'server.database.post_item': db[params.namespace + '/' + params.key] = params.value; return { value: params.value }
    case 'printer.gcode.script':
      if (/^WIFI_SCAN/.test(params.script)) {
        setTimeout(() => NETS.forEach(([s, sig, sec], i) => setTimeout(() => emitGcode('// ' + s + ':' + sig + ':' + sec), 120 * i)), 900)
      }
      return 'ok'
  }
  return {}
}

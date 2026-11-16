// Демо для розробки (npm run dev:screen, ?demo): імітація друку й відповідей Moonraker без принтера.
// ?demo&state=idle|printing|paused|shutdown — потрібний стан одразу. Лише в dev-збірці.

const idle0 = q => q.get('state') === 'idle'

export function startDemo({ merge, setKlippy }) {
  const q = new URLSearchParams(location.search)
  const want = q.get('state') || 'printing'
  if (want === 'shutdown') {
    setKlippy('shutdown', "Heater extruder not heating at expected rate\nSee the 'verify_heater' section in docs/Config_Reference.md\nfor the parameters that control this check.\nPrinter is shutdown")
    return
  }
  setKlippy('ready')
  merge(demoMotionStatus())
  merge({ gcode_move: { homing_origin: [0, 0, 0, 0], speed_factor: 1, extrude_factor: 1 }, fan: { speed: idle0(q) ? 0 : 0.4 } })
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
let db = { 'vyron_core/info': { version: '0.3.5', started: 0 } }

/** Імітація викликів Moonraker для сторінок налаштувань */
export async function demoCall(method, params, { emitGcode, merge }) {
  await wait(150)
  if (method.startsWith('machine.update.')) return demoUpdateCall(method, params)
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
    case 'server.files.metadata': return { size: 1200000 }
    case 'server.history.list': return { count: 1, jobs: [{ filename: 'SSR DIN clip.gcode', status: 'completed', print_duration: 8040, end_time: Date.now() / 1000 - 3 * 3600 }] }
    case 'printer.gcode.script':
      if (/G28|M84|QUAD_GANTRY_LEVEL|Z_TILT_ADJUST|G1 /.test(params.script)) return demoMotion(params.script, merge)
      if (/^WIFI_SCAN/.test(params.script)) {
        setTimeout(() => NETS.forEach(([s, sig, sec], i) => setTimeout(() => emitGcode('// ' + s + ':' + sig + ':' + sec), 120 * i)), 900)
      }
      return 'ok'
  }
  return {}
}

/** Спіральна «ваза» для демо (як у Vyron Web): 150 витків по 0.8 мм, 90 сегментів на виток. Повертає [P, F]. */
export function demoGcode() {
  const SEG = 90, LAYERS = 150, out = [], off = []
  let prev = null
  for (let s = 0; s < SEG * LAYERS; s++) {
    const z = 0.4 + (s / SEG) * 0.8, a = (s / SEG) * Math.PI * 2
    const r = 34 + 12 * Math.sin(z / 9) + 6 * Math.sin(a * 5) * (z / 120)
    const p = [175 + r * Math.cos(a), 175 + r * Math.sin(a), z]
    if (prev) { out.push(...prev, ...p); off.push(off.length) }
    prev = p
  }
  return [Float32Array.from(out), off]
}

// ---------- оновлення в демо ----------
let updateSink = () => {}
export const setDemoUpdateSink = fn => { updateSink = fn }
const updated = new Set()
const demoVersions = () => fixUp({
  klipper: { version: 'v0.13.0-560', remote_version: 'v0.13.0-573', commits_behind: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
  moonraker: { version: 'v0.9.3-41', remote_version: 'v0.9.3-41', commits_behind: [] },
  'vyron-ecosystem': { version: 'v0.2.0', remote_version: 'v0.3.0', configured_type: 'git_repo', commits_behind: [1, 2, 3] },
  mainsail: { version: 'v2.13.2', remote_version: 'v2.13.2', configured_type: 'web' },
  system: { package_count: 4, package_list: ['libc6', 'openssl', 'python3', 'tzdata'] }
})
/** Компоненти, «оновлені» в демо, показуються актуальними */
function fixUp(v) {
  for (const n of Object.keys(v)) {
    if (!updated.has(n) && !updated.has('all')) continue
    v[n] = n === 'system' ? { package_count: 0, package_list: [] } : { ...v[n], remote_version: v[n].version, commits_behind: [] }
  }
  return v
}
export function demoUpdateCall(method, params) {
  if (method === 'machine.update.status' || method === 'machine.update.refresh') return { busy: false, version_info: demoVersions() }
  const name = method === 'machine.update.full' ? 'all' : params.name || method.split('.').pop()
  const steps = ['Updating ' + name + '…', 'git fetch origin', 'git reset --hard', 'Restarting service…', 'Update complete']
  steps.forEach((m, i) => setTimeout(() => { if (i === steps.length - 1) updated.add(name); updateSink({ message: m, complete: i === steps.length - 1 }) }, 700 * (i + 1)))
  return 'ok'
}

// ---------- рух у демо: позиція, захомлені осі, вирівнювання ----------
const pos = [175, 175, 30, 0]
let homedAxes = ''
export const demoMotionStatus = () => ({ toolhead: { homed_axes: homedAxes, position: [...pos] }, quad_gantry_level: { applied: false } })
async function demoMotion(script, merge) {
  if (/M84/.test(script)) { homedAxes = ''; merge({ toolhead: { homed_axes: '' } }); return 'ok' }
  if (/G28/.test(script) && !/QUAD|Z_TILT/.test(script)) {
    await wait(1800)
    homedAxes = 'xyz'; pos[0] = 350; pos[1] = 350; pos[2] = 10
    merge({ toolhead: { homed_axes: homedAxes, position: [...pos] } })
    return 'ok'
  }
  if (/QUAD_GANTRY_LEVEL|Z_TILT_ADJUST/.test(script)) {
    merge({ quad_gantry_level: { applied: false } })
    await wait(2800)
    homedAxes = 'xyz'; pos[2] = 10
    merge({ toolhead: { homed_axes: homedAxes, position: [...pos] }, quad_gantry_level: { applied: true } })
    return 'ok'
  }
  const m = /G1 ([XYZ])(-?[\d.]+)/.exec(script)
  if (m) {
    const i = 'XYZ'.indexOf(m[1])
    if (!homedAxes.includes(m[1].toLowerCase())) throw new Error('Must home axis first: ' + pos.slice(0, 3).join(' '))
    await wait(250)
    pos[i] = Math.round((pos[i] + Number(m[2])) * 100) / 100
    merge({ toolhead: { position: [...pos] } })
  }
  return 'ok'
}

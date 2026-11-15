// Демо-режим: імітація друку і фейкові відповіді Moonraker. Команди нікуди не надсилаються.

export const DEMO_DEFAULT_TOOLS = 6
export const DEMO_MAX_TOOLS = 12

/** Список екструдерів демо-принтера: extruder, extruder1, … */
export const demoTools = n => Array.from({ length: n }, (_, i) => (i ? 'extruder' + i : 'extruder'))

// Плати голів у демо: усі на CAN (EBB36 / SB2209), T4 — USB-плата, а остання голова
// (якщо голів більше однієї) — напряму на материнській платі, щоб було видно картку без блоку плати.
const uuid = i => ((0xf3e9a0b47c21 + i * 0x9e3779b1) % 0xffffffffffff).toString(16).padStart(12, '0')
export function demoToolheads(tools) {
  const n = tools.length
  return Object.fromEntries(tools.map((tool, i) => {
    if (n > 1 && i === n - 1) return [tool, null]
    const can = !(i === 4 && n > 5)
    const mcu = can ? (i % 2 ? 'SB2209_' : 'EBBCan') + i : 'Nitehawk' + i
    return [tool, {
      mcu, mcuObj: 'mcu ' + mcu, link: can ? 'can' : 'usb',
      canbusUuid: can ? uuid(i) : null, canbusInterface: can ? 'can0' : null,
      serial: can ? null : '/dev/serial/by-id/usb-Klipper_rp2040_4E363334320E1A3C-if00',
      sensors: [{ obj: 'temperature_sensor ' + mcu + '_mcu', name: mcu + '_mcu', chip: true }],
      fans: [
        { obj: 'heater_fan hotend_fan' + (i ? '_t' + i : ''), name: 'hotend_fan' + (i ? '_t' + i : ''), kind: 'hotend' },
        i ? { obj: 'fan_generic part_fan_t' + i, name: 'part_fan_t' + i, kind: 'generic' } : { obj: 'fan', name: 'fan', kind: 'part' }
      ],
      drivers: [{ obj: (i === 1 ? 'tmc2240 ' : 'tmc2209 ') + tool, name: i === 1 ? 'TMC2240' : 'TMC2209' }]
    }]
  }))
}
/**
 * BTT Eddy у демо: на T0 — окремий CAN-вузол [mcu eddy] (як на реальному Voron),
 * на T1 (якщо є і має плату) — Eddy на I²C самої плати голови (прив'язка «shared»).
 */
export function demoEddies(tools, heads) {
  const out = {}
  if (!tools.length) return out
  out[tools[0]] = [{
    name: 'btt_eddy', probeObj: 'probe_eddy_current btt_eddy', tempProbeObj: 'temperature_probe btt_eddy',
    chipObj: 'temperature_sensor btt_eddy_mcu', canStatsObj: 'canbus_stats eddy', mcu: 'eddy', mcuObj: 'mcu eddy',
    link: 'can', canbusUuid: '7d4c1b9e2a60', canbusInterface: 'can0', serial: null, sensorType: 'ldc1612', frequency: 12000000
  }]
  const t1 = tools[1], h1 = t1 && heads[t1]
  if (h1) {
    out[t1] = [{
      name: 'eddy_t1', probeObj: 'probe_eddy_current eddy_t1', tempProbeObj: 'temperature_probe eddy_t1',
      chipObj: null, canStatsObj: null, mcu: h1.mcu, mcuObj: h1.mcuObj, link: 'shared',
      canbusUuid: h1.canbusUuid, canbusInterface: h1.canbusInterface, serial: h1.serial, sensorType: 'ldc1612', frequency: 12000000
    }]
  }
  return out
}

export const DEMO_PRINT_SECONDS = 5400
export const DEMO_STEP = 35
export const DEMO_INTERVAL = 40

/** Спіральна «ваза»: 150 витків по 0.8 мм (висота ~120 мм), 90 сегментів на виток. */
const VASE_SEG = 90, VASE_PITCH = 0.8
export const DEMO_VASE_LAYERS = 150

/** Спіральна «ваза»: кожен сегмент має зміщення = власний індекс. */
export function demoGcode() {
  const out = [], off = []
  let prev = null, idx = 0
  for (let s = 0; s < VASE_SEG * DEMO_VASE_LAYERS; s++) {
    const z = 0.4 + (s / VASE_SEG) * VASE_PITCH, a = (s / VASE_SEG) * Math.PI * 2
    const r = 34 + 12 * Math.sin(z / 9) + 6 * Math.sin(a * 5) * (z / 120)
    const p = [175 + r * Math.cos(a), 175 + r * Math.sin(a), z]
    if (prev) { out.push(...prev, ...p); off.push(idx++) }
    prev = p
  }
  return { P: Float32Array.from(out), F: off, total: off.length }
}

export function demoMesh() {
  return {
    profile_name: 'demo',
    probed_matrix: Array.from({ length: 7 }, (_, y) =>
      Array.from({ length: 7 }, (_, x) => +(0.04 * Math.sin(x / 2) * Math.cos(y / 2.5) - 0.02).toFixed(3)))
  }
}

export function demoStaticStatus(toolheads, eddies = {}) {
  const st = {
    heater_bed: { temperature: 110, target: 110 },
    'temperature_sensor chamber': { temperature: 45 },
    gcode_move: { speed_factor: 1 },
    fan: { speed: 0.4 },
    quad_gantry_level: { applied: true },
    bed_mesh: demoMesh(),
    mcu: { mcu_version: 'v0.13.0-573-g644cda5e', mcu_build_versions: 'gcc: (15:14.2.rel1-1) 14.2.1 20241119 binutils: 2.42', mcu_constants: { MCU: 'stm32g0b1xx', CLOCK_FREQ: 64000000 },
      last_stats: { mcu_task_avg: 0.000066, mcu_task_stddev: 0.000057, freq: 63998525, bytes_retransmit: 0, bytes_invalid: 0 } },
    // Залізо: чип основної плати й хост (Raspberry Pi) — для «Інженерного меню»
    'mcu host': { mcu_version: 'v0.13.0-573-g644cda5e', mcu_build_versions: 'gcc: (Debian 12.2.0-14) 12.2.0 binutils: 2.40', mcu_constants: { MCU: 'linux', CLOCK_FREQ: 50000000 },
      last_stats: { mcu_task_avg: 0.00001, mcu_task_stddev: 0.000014, freq: 49999964, bytes_retransmit: 0, bytes_invalid: 0 } },
    'temperature_sensor mcu_temp': { temperature: 41.2 },
    'temperature_sensor raspberry_pi': { temperature: 51.8 },
    system_stats: { sysload: 0.62, cputime: 4210.5, memavail: 2563000 }
  }
  Object.values(toolheads).filter(Boolean).forEach((th, i) => {
    if (th.link === 'can') st['canbus_stats ' + th.mcu] = { bus_state: 'active', rx_error: 0, tx_error: 0, tx_retries: 0 }
    st[th.mcuObj] = {
      mcu_version: 'v0.13.0-' + (560 + i * 7) + '-g' + (0xaea1bcf56 + i).toString(16).slice(0, 9),
      mcu_build_versions: 'gcc: (15:12.2.rel1-1) 12.2.1 20221205 binutils: 2.40',
      mcu_constants: th.link === 'usb' ? { MCU: 'rp2040', CLOCK_FREQ: 12000000 } : { MCU: 'stm32g0b1xx', CLOCK_FREQ: 64000000 },
      last_stats: { mcu_task_avg: 0.000012 + i * 0.000004, mcu_task_stddev: 0.000014, freq: th.link === 'usb' ? 12000391 : 63999071, bytes_retransmit: 0, bytes_invalid: 0 }
    }
  })
  for (const list of Object.values(eddies)) for (const e of list) {
    st[e.probeObj] = { name: e.probeObj, last_query: false, last_z_result: 0 }
    if (e.link === 'can') {
      st[e.mcuObj] = { mcu_version: 'v0.13.0-656-g4cc47cf56', mcu_build_versions: 'gcc: (15:12.2.rel1-1) 12.2.1 20221205 binutils: 2.40', mcu_constants: { MCU: 'rp2040', CLOCK_FREQ: 12000000 },
        last_stats: { mcu_task_avg: 0.000007, mcu_task_stddev: 0.000012, freq: 12000428, bytes_retransmit: 0, bytes_invalid: 0 } }
      if (e.canStatsObj) st[e.canStatsObj] = { bus_state: 'active', rx_error: 0, tx_error: 0, tx_retries: 0 }
    }
  }
  return st
}

/** Патч статусу для одного кроку симуляції. */
export function demoTickStatus({ pos, progress, activeTool, tools, toolheads, eddies = {}, state = 'printing', filename = DEMO_PRINTING_FILE, heat = {} }) {
  const z = pos ? pos[2] : 0
  // Для спіральної вази шар — частка від 150 витків, синхронно з прогресом (100% → 150 / 150);
  // для інших файлів — із моделі (layerLabel).
  const layer = Math.min(DEMO_VASE_LAYERS, Math.max(1, Math.ceil(progress * DEMO_VASE_LAYERS)))
  const patch = {
    toolhead: { position: pos ? [pos[0], pos[1], z, 0] : [0, 0, 0, 0], extruder: tools[activeTool] },
    virtual_sdcard: { progress },
    print_stats: { state, filename, print_duration: progress * DEMO_PRINT_SECONDS,
      info: filename === DEMO_PRINTING_FILE ? { current_layer: layer, total_layer: DEMO_VASE_LAYERS } : {} }
  }
  // Температури — з імітації нагріву в сторі (demoHeatStep); без неї — сталі значення
  tools.forEach((n, i) => { patch[n] = heat[n] || { temperature: i === activeTool ? 205 : 25, target: i === activeTool ? 205 : 0 } })
  if (heat.heater_bed) patch.heater_bed = heat.heater_bed
  tools.forEach((tool, i) => {
    const th = toolheads[tool]
    if (!th) return
    const hot = i === activeTool
    patch[th.sensors[0].obj] = { temperature: (hot ? 52 : 34) + i * 1.5 }
    patch[th.fans[0].obj] = { speed: hot ? 1 : 0, rpm: hot ? 7800 + i * 40 : 0 }
    patch[th.fans[1].obj] = { speed: hot ? 0.4 : 0, rpm: null }
    patch[th.drivers[0].obj] = { temperature: th.drivers[0].name === 'TMC2240' ? 41 : null }
  })
  tools.forEach((tool, i) => (eddies[tool] || []).forEach(e => {
    const warm = i === activeTool ? 8 : 0
    if (e.tempProbeObj) patch[e.tempProbeObj] = { temperature: 41.5 + warm + progress * 3, compensation_enabled: true }
    if (e.chipObj) patch[e.chipObj] = { temperature: 46.8 + warm / 2 }
  }))
  for (const [obj, m] of demoMcuList(toolheads, eddies)) patch[obj] = { last_stats: demoMcuStats(m) }
  // Хост «живе»: легке коливання навантаження, пам'яті й температур чипів
  const w = Math.sin(Date.now() / 2300)
  patch.system_stats = { sysload: +(0.62 + 0.18 * w).toFixed(2), cputime: 4210.5 + (Date.now() / 1000) % 1000, memavail: 2563000 - Math.round(24000 * w) }
  patch['temperature_sensor mcu_temp'] = { temperature: 41.2 + 0.6 * w }
  patch['temperature_sensor raspberry_pi'] = { temperature: 51.8 + 1.4 * Math.sin(Date.now() / 3100) }
  return patch
}

/** Демо-хост для machine.system_info */
export const demoHostInfo = {
  cpu_info: { cpu_count: 4, model: 'Raspberry Pi 4 Model B Rev 1.4', cpu_desc: 'Cortex-A72', hardware_desc: 'BCM2711', total_memory: 3884000, memory_units: 'kB' },
  distribution: { name: 'Debian GNU/Linux 12 (bookworm)' }
}

/** Демо-датчики температури чипів: основна плата, хост і плати голів. */
export function demoHwSensors(toolheads) {
  return [
    { obj: 'temperature_sensor mcu_temp', name: 'mcu_temp', type: 'mcu', mcu: 'mcu' },
    { obj: 'temperature_sensor raspberry_pi', name: 'raspberry_pi', type: 'host', mcu: null },
    ...Object.values(toolheads).filter(Boolean).map(th => ({ obj: th.sensors[0].obj, name: th.sensors[0].name, type: 'mcu', mcu: th.mcu }))
  ]
}

export const demoSysInfo = {
  sver: 'v0.13.0-573-g644cda5e', shost: 'voron', sstate: 'ready', cpu: 18, cpuTemp: 52, memPct: 34, memGb: '3.7', uptimeKey: 'eng.demoUptime'
}

export const demoNetworks = [
  { ssid: 'Home-5G', sig: 82, sec: 'WPA2' },
  { ssid: 'Workshop', sig: 64, sec: 'WPA2' },
  { ssid: 'Guest', sig: 41, sec: '' }
]

export const demoUpdates = {
  klipper: { full_version_string: 'v0.12.0-300', commits_behind: [1, 2, 3] },
  moonraker: { full_version_string: 'v0.9.3', commits_behind: [] },
  'vyron': { version: 'v0.1.0', remote_version: 'v0.2.0', configured_type: 'web' },
  system: { package_count: 0 }
}

export function demoHistory() {
  const n = Date.now() / 1000
  const exists = name => demoFiles.some(f => f.path === name)
  return {
    jobs: [
      { filename: 'voron_cube.gcode', status: 'completed', start_time: n - 7200, print_duration: 5400, total_duration: 5500, filament_used: 18250, metadata: { layer_count: 300, object_height: 60 } },
      { filename: 'bracket.gcode', status: 'cancelled', start_time: n - 90000, print_duration: 1200, total_duration: 1300, filament_used: 2100, metadata: {} },
      { filename: 'fan_duct.gcode', status: 'klippy_shutdown', start_time: n - 180000, print_duration: 600, total_duration: 650, filament_used: 800, metadata: {} },
      { filename: 'old_part.gcode', status: 'completed', start_time: n - 400000, print_duration: 3000, total_duration: 3100, filament_used: 6000, metadata: {} }
    ].map(j => ({ ...j, exists: exists(j.filename) })),
    totals: { total_jobs: 12, total_print_time: 150000, total_filament_used: 210000 }
  }
}

// ---------- G-code файли демо-принтера: список, метадані, 3D-моделі, видалення ----------

/** Файл, який «друкується» в демо: його видалення має бути заблоковане. */
export const DEMO_PRINTING_FILE = 'demo_vase.gcode'

const svgThumb = (color, shape) => 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#15171a"/>${shape.replace(/C/g, color)}</svg>`)
const SHAPES = {
  vase: '<path d="M22 54h20l-3-16c6-6 6-14 2-22H23c-4 8-4 16 2 22z" fill="C"/>',
  cube: '<path d="M32 10 52 20v24L32 54 12 44V20z" fill="C"/><path d="M32 10 52 20 32 30 12 20z" fill="#fff" fill-opacity=".25"/>',
  bracket: '<path d="M12 50V14h12v26h28v10z" fill="C"/>',
  cylinder: '<ellipse cx="32" cy="18" rx="16" ry="6" fill="#fff" fill-opacity=".3"/><path d="M16 18v28c0 8 32 8 32 0V18c0 8-32 8-32 0z" fill="C"/>',
  tower: '<path d="M24 54V10h16v44z" fill="C"/><path d="M24 20h16M24 30h16M24 40h16" stroke="#000" stroke-opacity=".35" stroke-width="2"/>'
}
const DEMO_FILE_DEFS = [
  ['demo_vase.gcode', 'vase', '#f03a2e', 5400, 0.8, 'PETG', 0],
  ['voron_cube.gcode', 'cube', '#ff6b60', 2700, 0.2, 'ABS', 7200],
  ['bracket.gcode', 'bracket', '#789cff', 1900, 0.25, 'ASA', 90000],
  ['fan_duct.gcode', 'cylinder', '#7ddc9a', 3100, 0.2, 'ASA', 180000],
  ['calibration/temp_tower.gcode', 'tower', '#ffb4ad', 2200, 0.2, 'PLA', 260000]
]
/** Робочий список файлів демо (видалення змінює його до наступного запуску демо). */
export let demoFiles = []
const demoMeta = {}

export function resetDemoFiles() {
  const now = Date.now() / 1000
  demoFiles = DEMO_FILE_DEFS.map(([path, shape, color, est, lh, type, age], i) => {
    demoMeta[path] = { estimated_time: est, layer_height: lh, filament_type: type, slicer: 'OrcaSlicer', __thumb: svgThumb(color, SHAPES[shape]), __shape: shape }
    return { path, modified: now - age - i * 60, size: 400000 + i * 173000 }
  })
}
// Без виклику на рівні модуля: список заповнює startDemo() (resetDemoFiles), а відсутність побічних ефектів
// дає Rollup викинути весь модуль зі збірки для принтера.

export const demoFileList = () => demoFiles.map(f => ({ ...f }))
export const demoFileMeta = path => ({ ...(demoMeta[path] || {}) })
/** Блокування файлу, що друкується, перевіряє HistoryTab за print_stats (як і для реального принтера). */
export function demoDeleteFile(path) {
  demoFiles = demoFiles.filter(f => f.path !== path)
}

/** Процедурна модель для 3D-перегляду демо-файлу: стінки (3 периметри) + заповнення. */
export function demoPreviewModel(path) {
  const meta = demoMeta[path] || {}
  if (meta.__shape === 'vase' || !meta.__shape) return demoGcode()
  const lh = meta.layer_height || 0.2, out = [], off = [], tools = []
  let tool = 0
  const seg = (a, b, z) => { out.push(a[0], a[1], z, b[0], b[1], z); off.push(off.length); tools.push(tool) }
  const loop = (pts, z) => pts.forEach((p, i) => seg(p, pts[(i + 1) % pts.length], z))
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const circle = (cx, cy, r, n = 72) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * 2 * Math.PI), cy + r * Math.sin(i / n * 2 * Math.PI)])
  const hatch = (x0, y0, x1, y1, z, step, dir) => {
    if (dir) for (let x = x0; x <= x1; x += step) seg([x, y0], [x, y1], z)
    else for (let y = y0; y <= y1; y += step) seg([x0, y], [x1, y], z)
  }
  const C = 175, H = { cube: 20, bracket: 18, cylinder: 30, tower: 40 }[meta.__shape]
  const layers = Math.round(H / lh)
  for (let l = 0; l < layers; l++) {
    const z = +(lh * (l + 1)).toFixed(3), solid = l < 3 || l >= layers - 3, step = solid ? 0.45 : 3, dir = l & 1
    if (meta.__shape === 'cube') {
      for (let k = 0; k < 3; k++) loop(rect(C - 10 + k * 0.45, C - 10 + k * 0.45, C + 10 - k * 0.45, C + 10 - k * 0.45), z)
      hatch(C - 8.6, C - 8.6, C + 8.6, C + 8.6, z, step, dir)
    } else if (meta.__shape === 'bracket') {
      const w = z < 4 ? 40 : 10
      for (let k = 0; k < 3; k++) loop(rect(C - 20 + k * 0.45, C - 10 + k * 0.45, C - 20 + w - k * 0.45, C + 10 - k * 0.45), z)
      hatch(C - 18.6, C - 8.6, C - 21.4 + w, C + 8.6, z, step, dir)
    } else if (meta.__shape === 'cylinder') {
      const r = 14 - 5 * (z / H)
      for (let k = 0; k < 3; k++) loop(circle(C, C, r - k * 0.45), z)
    } else {
      // температурна вежа: кожен блок 10 мм — інша голова (T0…T3), як у багатоголовому друці
      tool = Math.floor(z / 10) % 4
      const w = 10 - Math.floor(z / 10) * 1.5
      for (let k = 0; k < 3; k++) loop(rect(C - w + k * 0.45, C - 6 + k * 0.45, C + w - k * 0.45, C + 6 - k * 0.45), z)
      hatch(C - w + 1.4, C - 4.6, C + w - 1.4, C + 4.6, z, step, dir)
    }
  }
  return { P: Float32Array.from(out), F: off, T: Uint8Array.from(tools), total: off.length }
}

// ---------- демо-MCU: живі last_stats і підключення ----------
const DEMO_T0 = Date.now() / 1000 - 1800
/** [[об'єкт MCU, { freq, w, r, task }]] — трафік (Б/с) приблизно як на реальному Voron */
function demoMcuList(toolheads, eddies) {
  const out = [['mcu', { freq: 63998612, w: 32, r: 340, task: 0.00001 }], ['mcu host', { freq: 49999964, w: 30, r: 95, task: 0.00001 }]]
  Object.values(toolheads).filter(Boolean).forEach((th, i) => out.push([th.mcuObj, th.link === 'usb' ? { freq: 12000391, w: 55, r: 610, task: 0.000012 } : { freq: 63999598 - i * 37, w: 60, r: 650, task: 0.000011 + i * 0.000001 }]))
  for (const list of Object.values(eddies)) for (const e of list) if (e.link === 'can') out.push([e.mcuObj, { freq: 12000428, w: 59, r: 652, task: 0.000007 }])
  return out
}
function demoMcuStats(m) {
  const t = Date.now() / 1000 - DEMO_T0, j = Math.sin(t * 1.7 + m.freq)
  return {
    mcu_awake: +(0.0015 + 0.0008 * j).toFixed(4), mcu_task_avg: m.task, mcu_task_stddev: m.task * 0.9,
    bytes_write: Math.round(t * m.w), bytes_read: Math.round(t * m.r), bytes_retransmit: 0, bytes_invalid: 0,
    srtt: +(0.0011 + 0.0002 * j).toFixed(4), rttvar: 0.0003, rto: 0.025, freq: m.freq
  }
}
/** Підключення демо-плат: основна — USB, голови — CAN/USB, Eddy — CAN, host — процес Linux */
export function demoMcuConn(toolheads, eddies) {
  const out = { mcu: { kind: 'usb', id: 'usb-Klipper_stm32g0b1xx_1D0036001950434B37383120-if00' }, 'mcu host': { kind: 'linux', id: '/tmp/klipper_host_mcu' } }
  Object.values(toolheads).filter(Boolean).forEach((th, i) => {
    out[th.mcuObj] = th.link === 'can' ? { kind: 'can', iface: 'can0', id: (0xf3e9a0b47c21 + i * 0x1111).toString(16) } : { kind: 'usb', id: 'usb-Klipper_rp2040_E66138935F4B' + i + 'A28-if00' }
  })
  for (const list of Object.values(eddies)) for (const e of list) if (e.link === 'can') out[e.mcuObj] = { kind: 'can', iface: 'can0', id: '7d4c1b9e2a60' }
  return out
}

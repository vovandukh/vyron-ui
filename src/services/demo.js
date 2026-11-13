// Демо-режим: імітація друку і фейкові відповіді Moonraker. Команди нікуди не надсилаються.

export const DEMO_DEFAULT_TOOLS = 6
export const DEMO_MAX_TOOLS = 12

/** Список екструдерів демо-принтера: extruder, extruder1, … */
export const demoTools = n => Array.from({ length: n }, (_, i) => (i ? 'extruder' + i : 'extruder'))

// Плати голів у демо: усі на CAN (EBB36 / SB2209), T4 — USB-плата, а остання голова
// (якщо голів більше однієї) — напряму на материнській платі, щоб було видно картку без блоку плати.
const uuid = i => ((0x5bff930ca785 + i * 0x9e3779b1) % 0xffffffffffff).toString(16).padStart(12, '0')
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
export const DEMO_PRINT_SECONDS = 5400
export const DEMO_STEP = 35
export const DEMO_INTERVAL = 40

/** Спіральна «ваза»: кожен сегмент має зміщення = власний індекс. */
export function demoGcode() {
  const out = [], off = []
  let prev = null, idx = 0
  for (let s = 0; s < 13500; s++) {
    const z = 0.4 + (s / 90) * 0.8, a = (s / 90) * Math.PI * 2
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

export function demoStaticStatus(toolheads) {
  const st = {
    heater_bed: { temperature: 110, target: 110 },
    'temperature_sensor chamber': { temperature: 45 },
    gcode_move: { speed_factor: 1 },
    fan: { speed: 0.4 },
    quad_gantry_level: { applied: true },
    bed_mesh: demoMesh(),
    mcu: { mcu_version: 'v0.13.0-573-g644cda5e', last_stats: { mcu_task_avg: 0.000066, mcu_task_stddev: 0.000057, freq: 63998525 } }
  }
  Object.values(toolheads).filter(Boolean).forEach((th, i) => {
    st[th.mcuObj] = {
      mcu_version: 'v0.13.0-' + (560 + i * 7) + '-g' + (0xaea1bcf56 + i).toString(16).slice(0, 9),
      last_stats: { mcu_task_avg: 0.000012 + i * 0.000004, mcu_task_stddev: 0.000014, freq: th.link === 'usb' ? 133000000 : 63999071 }
    }
  })
  return st
}

/** Патч статусу для одного кроку симуляції. */
export function demoTickStatus({ pos, progress, activeTool, tools, toolheads }) {
  const z = pos ? pos[2] : 0
  const patch = {
    toolhead: { position: pos ? [pos[0], pos[1], z, 0] : [0, 0, 0, 0], extruder: tools[activeTool] },
    virtual_sdcard: { progress },
    print_stats: { state: 'printing', print_duration: progress * DEMO_PRINT_SECONDS, info: { current_layer: Math.round(z / 0.8), total_layer: 120 } }
  }
  tools.forEach((n, i) => { patch[n] = { temperature: i === activeTool ? 205 : 25, target: i === activeTool ? 205 : 0 } })
  tools.forEach((tool, i) => {
    const th = toolheads[tool]
    if (!th) return
    const hot = i === activeTool
    patch[th.sensors[0].obj] = { temperature: (hot ? 52 : 34) + i * 1.5 }
    patch[th.fans[0].obj] = { speed: hot ? 1 : 0, rpm: hot ? 7800 + i * 40 : 0 }
    patch[th.fans[1].obj] = { speed: hot ? 0.4 : 0, rpm: null }
    patch[th.drivers[0].obj] = { temperature: th.drivers[0].name === 'TMC2240' ? 41 : null }
  })
  return patch
}

export const demoSysInfo = {
  sver: 'v0.12.x', shost: 'voron', sstate: 'ready', cpu: 18, cpuTemp: 52, memPct: 34, memGb: '3.7', uptimeKey: 'eng.demoUptime'
}

export const demoNetworks = [
  { ssid: 'Home-5G', sig: 82, sec: 'WPA2' },
  { ssid: 'Workshop', sig: 64, sec: 'WPA2' },
  { ssid: 'Guest', sig: 41, sec: '' }
]

export const demoUpdates = {
  klipper: { full_version_string: 'v0.12.0-300', commits_behind: [1, 2, 3] },
  moonraker: { full_version_string: 'v0.9.3', commits_behind: [] },
  'voron-ui': { version: 'v0.1.0', remote_version: 'v0.2.0', configured_type: 'web' },
  system: { package_count: 0 }
}

export function demoHistory() {
  const n = Date.now() / 1000
  return {
    jobs: [
      { filename: 'voron_cube.gcode', status: 'completed', start_time: n - 7200, print_duration: 5400, total_duration: 5500, filament_used: 18250, metadata: { layer_count: 300, object_height: 60 } },
      { filename: 'bracket.gcode', status: 'cancelled', start_time: n - 90000, print_duration: 1200, total_duration: 1300, filament_used: 2100, metadata: {} },
      { filename: 'fan_duct.gcode', status: 'klippy_shutdown', start_time: n - 180000, print_duration: 600, total_duration: 650, filament_used: 800, metadata: {} }
    ],
    totals: { total_jobs: 12, total_print_time: 150000, total_filament_used: 210000 }
  }
}

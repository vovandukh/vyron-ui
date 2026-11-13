// Демо-режим: імітація друку і фейкові відповіді Moonraker. Команди нікуди не надсилаються.

export const DEMO_TOOLS = ['extruder', 'extruder1', 'extruder2', 'extruder3', 'extruder4', 'extruder5']
export const DEMO_BOARDS = DEMO_TOOLS.map((_, i) => 'temperature_sensor ebb_t' + i)
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

export function demoStaticStatus() {
  return {
    heater_bed: { temperature: 110, target: 110 },
    'temperature_sensor chamber': { temperature: 45 },
    gcode_move: { speed_factor: 1 },
    fan: { speed: 0.4 },
    quad_gantry_level: { applied: true },
    bed_mesh: demoMesh()
  }
}

/** Патч статусу для одного кроку симуляції. */
export function demoTickStatus({ pos, progress, activeTool }) {
  const z = pos ? pos[2] : 0
  const patch = {
    toolhead: { position: pos ? [pos[0], pos[1], z, 0] : [0, 0, 0, 0], extruder: DEMO_TOOLS[activeTool] },
    virtual_sdcard: { progress },
    print_stats: { state: 'printing', print_duration: progress * DEMO_PRINT_SECONDS, info: { current_layer: Math.round(z / 0.8), total_layer: 120 } }
  }
  DEMO_TOOLS.forEach((n, i) => { patch[n] = { temperature: i === activeTool ? 205 : 25, target: i === activeTool ? 205 : 0 } })
  DEMO_BOARDS.forEach((n, i) => { patch[n] = { temperature: 38 + i * 2 } })
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

// Розбір об'єктів Klipper: пошук екструдерів T0–T5 і датчиків плат EBB36.

export const MAX_TOOLS = 6

export function discoverTools(objectList) {
  const tools = objectList
    .filter(n => /^extruder\d*$/.test(n))
    .sort((a, b) => (a === 'extruder' ? -1 : b === 'extruder' ? 1 : a.localeCompare(b, undefined, { numeric: true })))
    .slice(0, MAX_TOOLS)

  // Датчик плати: temperature_sensor <ім'я з ebb|can|board|head|tool> із номером 0–5 у кінці.
  const boards = []
  objectList.filter(n => /^temperature_sensor /.test(n)).forEach(n => {
    const s = n.slice(19).toLowerCase()
    if (!/ebb|can|board|head|tool/.test(s)) return
    const m = s.match(/(\d+)\D*$/)
    if (!m) return
    const i = Number(m[1])
    if (i >= 0 && i < MAX_TOOLS && !boards[i]) boards[i] = n
  })
  return { tools, boards }
}

const BASE_OBJECTS = ['print_stats', 'virtual_sdcard', 'heater_bed', 'toolhead', 'gcode_move', 'fan',
  'quad_gantry_level', 'bed_mesh', 'temperature_sensor chamber', 'heater_generic chamber']

/** Об'єкт для printer.objects.subscribe лише з тих об'єктів, що реально існують. */
export function subscriptionObjects(objectList, tools, boards, extra = []) {
  const names = [...BASE_OBJECTS, ...tools, ...boards.filter(Boolean), ...extra]
  const objects = {}
  names.forEach(n => { if (objectList.includes(n)) objects[n] = null })
  return objects
}

export const STATE_KEYS = {
  printing: 'state.printing', paused: 'state.paused', standby: 'state.standby',
  complete: 'state.complete', cancelled: 'state.cancelled', error: 'state.error'
}

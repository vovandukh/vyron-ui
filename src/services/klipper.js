// Розбір об'єктів Klipper: пошук усіх екструдерів (будь-яка кількість) і датчиків плат голів.

/** Номер інструмента з імені екструдера: extruder → 0, extruder3 → 3. */
export const toolNum = name => (name === 'extruder' ? 0 : Number(String(name).slice(8)) || 0)

export function discoverTools(objectList) {
  const tools = objectList
    .filter(n => /^extruder\d*$/.test(n))
    .sort((a, b) => toolNum(a) - toolNum(b))

  // Запасний варіант для конфігів без прив'язки пінів: датчик з назвою на кшталт ebb_t3,
  // індексований номером голови.
  const nums = new Set(tools.map(toolNum))
  const boards = {}
  objectList.filter(n => /^temperature_sensor /.test(n)).forEach(n => {
    const s = n.slice(19).toLowerCase()
    if (!/ebb|can|board|head|tool/.test(s)) return
    const m = s.match(/(\d+)\D*$/)
    if (!m) return
    const i = Number(m[1])
    if (nums.has(i) && !boards[i]) boards[i] = n
  })
  return { tools, boards }
}

const BASE_OBJECTS = ['print_stats', 'virtual_sdcard', 'heater_bed', 'toolhead', 'gcode_move', 'fan',
  'quad_gantry_level', 'bed_mesh', 'temperature_sensor chamber', 'heater_generic chamber']

/** Об'єкт для printer.objects.subscribe лише з тих об'єктів, що реально існують. */
export function subscriptionObjects(objectList, tools, boards, extra = []) {
  const names = [...BASE_OBJECTS, ...tools, ...Object.values(boards), ...extra]
  const objects = {}
  names.forEach(n => { if (objectList.includes(n)) objects[n] = null })
  return objects
}

export const STATE_KEYS = {
  printing: 'state.printing', paused: 'state.paused', standby: 'state.standby',
  complete: 'state.complete', cancelled: 'state.cancelled', error: 'state.error'
}

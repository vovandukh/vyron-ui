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
  'quad_gantry_level', 'z_tilt', 'bed_mesh']

/**
 * Датчик температури камери, якщо він є в конфігурації: спершу канонічні імена,
 * далі будь-який temperature_sensor / heater_generic / temperature_fan зі словом «chamber» у назві.
 */
export function findChamber(objectList) {
  for (const n of ['temperature_sensor chamber', 'heater_generic chamber', 'temperature_fan chamber']) if (objectList.includes(n)) return n
  return objectList.find(n => /^(temperature_sensor|heater_generic|temperature_fan) .*chamber/i.test(n)) || null
}

/** Усі мікроконтролери: основна плата 'mcu' і додаткові 'mcu EBBCan', 'mcu host'… (основна — першою). */
export const findMcus = objectList => objectList.filter(n => /^mcu( |$)/.test(n)).sort((a, b) => (a === 'mcu' ? -1 : b === 'mcu' ? 1 : a.localeCompare(b)))

/** Ім'я MCU для sensor_mcu: 'mcu' → 'mcu', 'mcu EBBCan' → 'EBBCan'. */
export const mcuName = obj => (obj === 'mcu' ? 'mcu' : obj.slice(4))

/**
 * Апаратні датчики температури: [{ obj, name, type, mcu }], де type —
 *   'mcu'   чип мікроконтролера (sensor_type: temperature_mcu, плата — sensor_mcu);
 *   'host'  процесор хоста (sensor_type: temperature_host — зокрема всередині temperature_fan,
 *           а також об'єкт 'temperature_host <ім'я>', який Klipper реєструє сам);
 *   'board' термістор на самій платі (sensor_pin «EBBCan: PA2» + назва на кшталт EBB_NTC / board).
 * Без налаштувань printer.cfg — за назвою (mcu_temp, raspberry_pi, cb1, host…).
 */
const SENSOR_OBJ = /^(temperature_sensor|temperature_fan|heater_generic) /
export function findHwSensors(objectList, settings = null) {
  const out = []
  for (const obj of objectList) {
    if (/^temperature_host /.test(obj)) { out.push({ obj, name: obj.slice(17), type: 'host', mcu: null }); continue }
    if (!SENSOR_OBJ.test(obj)) continue
    const name = obj.slice(obj.indexOf(' ') + 1)
    const cfg = settings ? settings[obj.toLowerCase()] : null
    if (cfg && cfg.sensor_type) {
      if (cfg.sensor_type === 'temperature_mcu') out.push({ obj, name, type: 'mcu', mcu: cfg.sensor_mcu || 'mcu' })
      else if (cfg.sensor_type === 'temperature_host') out.push({ obj, name, type: 'host', mcu: null })
      else {
        // Термістор на платі голови: пін іншого MCU і «плитна» назва (камеру чи нагрівач сюди не беремо)
        const m = /^\s*([^:\s]+)\s*:/.exec(String(cfg.sensor_pin || ''))
        if (m && /^temperature_sensor /.test(obj) && /ntc|board|ebb|sb2209|sb2240|nhk|nitehawk|toolhead|chip/i.test(name)) out.push({ obj, name, type: 'board', mcu: m[1] })
      }
      continue
    }
    if (!/^temperature_sensor /.test(obj)) continue
    if (/raspberry|rpi|\bpi\b|cb1|cb2|host|orange|manta_host/i.test(name)) out.push({ obj, name, type: 'host', mcu: null })
    else if (/^mcu(_temp)?$|_mcu$|mcu_temp/i.test(name)) out.push({ obj, name, type: 'mcu', mcu: name.replace(/_?mcu(_temp)?$/i, '') || 'mcu' })
  }
  return out
}

/**
 * Як підключено кожен MCU (з секцій [mcu …] printer.cfg):
 * { 'mcu EBBCan': { kind: 'can', iface: 'can0', id: '5bff930ca785' }, mcu: { kind: 'usb', id: 'usb-Klipper_stm32…-if00' }, … }
 */
export function mcuConnections(settings, mcus) {
  const out = {}
  for (const obj of mcus) {
    const c = settings[obj.toLowerCase()]
    if (!c) continue
    if (c.canbus_uuid) out[obj] = { kind: 'can', iface: c.canbus_interface || 'can0', id: c.canbus_uuid }
    else if (c.serial) {
      const s = String(c.serial)
      if (/klipper_host_mcu/.test(s)) out[obj] = { kind: 'linux', id: s }
      else if (/\/by-id\/usb-|ttyACM|ttyUSB/.test(s)) out[obj] = { kind: 'usb', id: s.split('/').pop() }
      else out[obj] = { kind: 'uart', id: s, baud: c.baud || null }
    }
  }
  return out
}

/** Об'єкт вирівнювання порталу: QGL (Voron 2.x) або Z-Tilt (Trident тощо). */
export function findLeveling(objectList) {
  if (objectList.includes('quad_gantry_level')) return { obj: 'quad_gantry_level', kind: 'qgl' }
  if (objectList.includes('z_tilt')) return { obj: 'z_tilt', kind: 'ztilt' }
  return null
}

/** Об'єкт для printer.objects.subscribe лише з тих об'єктів, що реально існують. */
export function subscriptionObjects(objectList, tools, boards, extra = []) {
  const names = [...BASE_OBJECTS, findChamber(objectList), ...tools, ...Object.values(boards), ...extra].filter(Boolean)
  const objects = {}
  names.forEach(n => { if (objectList.includes(n)) objects[n] = null })
  return objects
}

export const STATE_KEYS = {
  printing: 'state.printing', paused: 'state.paused', standby: 'state.standby',
  complete: 'state.complete', cancelled: 'state.cancelled', error: 'state.error'
}

// Автоматичне визначення плати голови (toolboard / CAN MCU) для кожного екструдера
// за configfile.settings Klipper.
//
// Особливості реальних конфігів:
//  - пін може мати модифікатори й пробіли: "!EBBCan: PD2", "^EBBCan:PA3";
//  - configfile.settings містить назви секцій у нижньому регістрі ("mcu ebbcan"),
//    а runtime-об'єкти зберігають регістр з printer.cfg ("mcu EBBCan") — тому імена для
//    підписки беремо з printer.objects.list без урахування регістру.

const lc = s => String(s).toLowerCase()
const EXTRUDER_PINS = ['heater_pin', 'sensor_pin', 'step_pin', 'dir_pin', 'enable_pin']
const FAN_KINDS = [
  [/^fan$/, 'part'], [/^fan_generic /, 'generic'], [/^heater_fan /, 'hotend'],
  [/^controller_fan /, 'controller'], [/^temperature_fan /, 'generic']
]

/** Назва MCU піна з оригінальним регістром ("EBBCan"), 'mcu' для основної плати, null якщо це не пін. */
export function pinMcu(v) {
  if (typeof v !== 'string' || !v.trim()) return null
  const s = v.trim().replace(/^[!^~\s]+/, '')
  const i = s.indexOf(':')
  return i < 0 ? 'mcu' : s.slice(0, i).trim()
}

/** Скорочений ID для відображення: f3e9a0b47c21 → f3e9…7c21 */
export const shortId = id => (id && id.length > 10 ? id.slice(0, 4) + '…' + id.slice(-4) : id || '')

/**
 * Навантаження MCU як у Mainsail: (task_avg + 3·task_stddev) / 0.0025.
 * Повертає частку 0..1 або null.
 */
export function mcuLoad(stats) {
  if (!stats || stats.mcu_task_avg == null) return null
  return (stats.mcu_task_avg + 3 * (stats.mcu_task_stddev || 0)) / 0.0025
}

/**
 * @param settings   configfile.settings
 * @param tools      ['extruder', 'extruder1', …] (runtime-імена)
 * @param objectList printer.objects.list
 * @returns { [toolName]: Toolhead | null }
 *
 * Toolhead = { mcu, mcuObj, link: 'can'|'usb'|'mcu', canbusUuid, canbusInterface, serial,
 *              sensors: [{ obj, name, chip }], fans: [{ obj, name, kind }], drivers: [{ obj, name }] }
 */
export function detectToolheads(settings, tools, objectList) {
  const byLc = new Map(objectList.map(o => [lc(o), o]))
  const resolve = sec => byLc.get(lc(sec)) || null
  const sections = Object.keys(settings || {})
  const out = {}

  for (const tool of tools) {
    const ex = settings[lc(tool)]
    if (!ex) { out[tool] = null; continue }

    // MCU, на якому висить найбільше пінів екструдера (крім основної плати).
    const votes = new Map()
    for (const k of EXTRUDER_PINS) {
      const m = pinMcu(ex[k])
      if (!m || lc(m) === 'mcu') continue
      const v = votes.get(lc(m)) || { name: m, n: 0 }
      v.n++
      votes.set(lc(m), v)
    }
    const best = [...votes.values()].sort((a, b) => b.n - a.n)[0]
    if (!best) { out[tool] = null; continue }

    const key = lc(best.name)
    const mcuCfg = settings['mcu ' + key] || {}
    const onBoard = sec => {
      const s = settings[sec] || {}
      return Object.keys(s).some(k => /(^|_)pin$/.test(k) && lc(pinMcu(s[k]) || '') === key)
    }

    const sensors = sections
      .filter(sec => sec.startsWith('temperature_sensor '))
      .filter(sec => {
        const s = settings[sec]
        return lc(s.sensor_mcu || '') === key || onBoard(sec) || lc(sec.slice(19)).includes(key)
      })
      .map(sec => ({ obj: resolve(sec), name: (resolve(sec) || sec).slice(19), chip: settings[sec].sensor_type === 'temperature_mcu' }))
      .filter(s => s.obj)

    const fans = sections
      .map(sec => ({ sec, kind: (FAN_KINDS.find(([re]) => re.test(sec)) || [])[1] }))
      .filter(f => f.kind && onBoard(f.sec))
      .map(f => ({ obj: resolve(f.sec), name: (resolve(f.sec) || f.sec).replace(/^\S+ ?/, '') || f.sec, kind: f.kind }))
      .filter(f => f.obj)

    // Драйвер екструдера: [tmc2209 extruder], [tmc2240 extruder1] … (температуру мають лише деякі, напр. TMC2240).
    const drivers = sections
      .filter(sec => /^tmc\w+ /.test(sec) && sec.split(' ')[1] === lc(tool))
      .map(sec => ({ obj: resolve(sec), name: sec.split(' ')[0].toUpperCase() }))
      .filter(d => d.obj)

    out[tool] = {
      mcu: best.name,
      mcuObj: resolve('mcu ' + key),
      link: mcuCfg.canbus_uuid ? 'can' : mcuCfg.serial ? 'usb' : 'mcu',
      canbusUuid: mcuCfg.canbus_uuid || null,
      canbusInterface: mcuCfg.canbus_interface || null,
      serial: mcuCfg.serial || null,
      sensors, fans, drivers
    }
  }
  return out
}

/** Усі runtime-об'єкти, на які треба підписатися для карток голів. */
export function toolheadObjects(map) {
  const names = new Set()
  for (const th of Object.values(map || {})) {
    if (!th) continue
    if (th.mcuObj) names.add(th.mcuObj)
    th.sensors.forEach(s => names.add(s.obj))
    th.fans.forEach(f => names.add(f.obj))
    th.drivers.forEach(d => names.add(d.obj))
  }
  return [...names]
}

/** Температура плати: чип MCU (temperature_mcu), інакше перший датчик на платі. */
export function boardSensor(th) {
  return th.sensors.find(s => s.chip) || th.sensors[0] || null
}

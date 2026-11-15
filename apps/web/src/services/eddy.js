// Автоматичне визначення датчиків BTT Eddy (probe_eddy_current) і прив'язка до голів.
//
// Прив'язка:
//  1. i2c_mcu датчика збігається з MCU плати голови (напр. Eddy на SB2209) → ця голова;
//  2. інакше (окремий CAN/USB-вузол [mcu eddy] або основна плата) → T0 (перша голова).
// Імена runtime-об'єктів беруться з printer.objects.list без урахування регістру —
// configfile.settings містить назви секцій у нижньому регістрі.

const lc = s => String(s).toLowerCase()

/**
 * @returns { [toolName]: Eddy[] }
 * Eddy = { name, probeObj, tempProbeObj, chipObj, canStatsObj, mcu, mcuObj, link: 'can'|'usb'|'shared'|'main',
 *          canbusUuid, canbusInterface, serial, sensorType, frequency }
 */
export function detectEddy(settings, tools, toolheads, objectList) {
  const byLc = new Map(objectList.map(o => [lc(o), o]))
  const resolve = sec => byLc.get(lc(sec)) || null
  const sections = Object.keys(settings || {})
  const out = {}
  if (!tools.length) return out

  for (const sec of sections.filter(s => s.startsWith('probe_eddy_current '))) {
    const cfg = settings[sec] || {}
    const name = sec.slice(19)
    const mcuKey = lc(cfg.i2c_mcu || 'mcu')
    const mcuSec = mcuKey === 'mcu' ? 'mcu' : 'mcu ' + mcuKey
    const mcuCfg = settings[mcuSec] || {}

    // 1) той самий MCU, що й у плати голови
    let tool = tools.find(t => toolheads[t] && lc(toolheads[t].mcu) === mcuKey)
    const shared = !!tool
    // 2) окремий вузол або основна плата → T0
    if (!tool) tool = tools[0]

    // Температура чипа MCU датчика: temperature_sensor з sensor_mcu = цей MCU (temperature_mcu)
    const chipSec = mcuKey === 'mcu' ? null : sections.find(s => s.startsWith('temperature_sensor ') &&
      settings[s].sensor_type === 'temperature_mcu' && lc(settings[s].sensor_mcu || '') === mcuKey)

    const eddy = {
      name: (resolve(sec) || sec).slice(19) || name,
      probeObj: resolve(sec),
      tempProbeObj: resolve('temperature_probe ' + name),
      chipObj: chipSec ? resolve(chipSec) : null,
      canStatsObj: mcuKey === 'mcu' ? null : resolve('canbus_stats ' + mcuKey),
      mcu: mcuKey === 'mcu' ? 'mcu' : (resolve(mcuSec) || mcuSec).slice(4),
      mcuObj: resolve(mcuSec),
      link: shared ? 'shared' : mcuCfg.canbus_uuid ? 'can' : mcuKey !== 'mcu' && mcuCfg.serial ? 'usb' : 'main',
      canbusUuid: mcuCfg.canbus_uuid || null,
      canbusInterface: mcuCfg.canbus_interface || null,
      serial: mcuKey !== 'mcu' ? mcuCfg.serial || null : null,
      sensorType: cfg.sensor_type || null,
      frequency: Number(cfg.frequency) || null
    }
    if (!eddy.probeObj) continue
    ;(out[tool] = out[tool] || []).push(eddy)
  }
  return out
}

/** Runtime-об'єкти Eddy для підписки. Для shared MCU плата голови вже підписана окремо. */
export function eddyObjects(map) {
  const names = new Set()
  for (const list of Object.values(map || {})) for (const e of list) {
    ;[e.probeObj, e.tempProbeObj, e.chipObj, e.canStatsObj, e.link !== 'main' ? e.mcuObj : null].forEach(n => n && names.add(n))
  }
  return [...names]
}

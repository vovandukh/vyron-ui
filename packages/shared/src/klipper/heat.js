// Нагрів — спільне для Vyron Web і Vyron Screen: пресети матеріалів і G-code.
// SET_HEATER_TEMPERATURE працює для будь-якого нагрівача Klipper (extruder, extruder1, heater_bed, heater_generic …),
// TURN_OFF_HEATERS вимикає всі. Klipper сам відхилить ціль вище max_temp з printer.cfg.

/** Пресети матеріалів: сопло / стіл, °C — типові значення для більшості філаментів */
export const HEAT_PRESETS = [
  { id: 'pla', name: 'PLA', nozzle: 210, bed: 60 },
  { id: 'petg', name: 'PETG', nozzle: 240, bed: 80 },
  { id: 'abs', name: 'ABS', nozzle: 250, bed: 100 },
  { id: 'asa', name: 'ASA', nozzle: 260, bed: 100 }
]

/** Верхні межі інтерфейсу (на випадок помилки введення; справжня межа — max_temp у printer.cfg) */
export const HEAT_MAX = { nozzle: 320, bed: 130 }
export const HEAT_STEP = 5

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
/** Тип нагрівача за іменем об'єкта Klipper */
export const heaterKind = name => (/^extruder\d*$/.test(name) ? 'nozzle' : name === 'heater_bed' ? 'bed' : 'other')

export function heaterScript(name, target) {
  const max = HEAT_MAX[heaterKind(name)] || 150
  return `SET_HEATER_TEMPERATURE HEATER=${name} TARGET=${Math.round(clamp(Number(target) || 0, 0, max))}`
}
export const HEAT_OFF = 'TURN_OFF_HEATERS'

/** Чи пресет зараз «увімкнений» (цілі збігаються) */
export const presetActive = (p, nozzleTarget, bedTarget) => p.nozzle === Math.round(nozzleTarget || 0) && p.bed === Math.round(bedTarget || 0)

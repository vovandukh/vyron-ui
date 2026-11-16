// Тонке налаштування під час друку — спільне для Vyron Web і Vyron Screen.
//   Z-зсув (babystep): SET_GCODE_OFFSET Z_ADJUST=… MOVE=1 — голова зсувається одразу, діє до кінця друку
//   Швидкість: M220 S<%>   Потік: M221 S<%>   Обдув моделі: M106 S<0…255>
// Значення беруться з об'єктів Klipper gcode_move (homing_origin, speed_factor, extrude_factor) і fan (speed).

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/** Об'єкти Klipper, на які треба підписатися: { об'єкт: [поля] } */
export const TUNE_OBJECTS = { gcode_move: ['homing_origin', 'speed_factor', 'extrude_factor'], fan: ['speed'] }

/** Кроки кнопок: Z — мм, решта — відсотки */
export const TUNE_STEPS = { z: [0.01, 0.05], speed: 5, flow: 1, fan: 10 }
export const TUNE_LIMITS = { speed: [10, 300], flow: [50, 150], fan: [0, 100], z: [-2, 2] }

/** Поточні значення з об'єктів Klipper (st — злитий стан printer.objects) */
export function tuneValues(st) {
  const g = (st && st.gcode_move) || {}, f = (st && st.fan) || {}
  const ho = g.homing_origin || []
  return {
    z: Number(ho[2]) || 0,
    speed: Math.round((g.speed_factor == null ? 1 : g.speed_factor) * 100),
    flow: Math.round((g.extrude_factor == null ? 1 : g.extrude_factor) * 100),
    fan: f.speed == null ? null : Math.round(f.speed * 100)
  }
}

/** «+0.025» — знак завжди, три знаки після коми (крок 0.005 видно) */
export const fmtZ = z => (z > 0 ? '+' : z < 0 ? '−' : '') + Math.abs(z).toFixed(3)

/**
 * G-code для зміни. kind: 'z' (v — приріст, мм), 'zreset', 'speed' | 'flow' | 'fan' (v — нове значення, %).
 * Значення обмежуються безпечними межами.
 */
export function tuneScript(kind, v) {
  switch (kind) {
    case 'z': return `SET_GCODE_OFFSET Z_ADJUST=${clamp(Number(v), -0.5, 0.5).toFixed(3)} MOVE=1`
    case 'zreset': return 'SET_GCODE_OFFSET Z=0 MOVE=1'
    case 'speed': return `M220 S${Math.round(clamp(v, ...TUNE_LIMITS.speed))}`
    case 'flow': return `M221 S${Math.round(clamp(v, ...TUNE_LIMITS.flow))}`
    case 'fan': return `M106 S${Math.round(clamp(v, ...TUNE_LIMITS.fan) * 2.55)}`
    default: return null
  }
}

/** Для демо: як зміниться стан після команди (без принтера) */
export function tunePatch(st, kind, v) {
  const t = tuneValues(st), g = (st && st.gcode_move) || {}
  const ho = (g.homing_origin || [0, 0, 0, 0]).slice()
  switch (kind) {
    case 'z': ho[2] = clamp(t.z + Number(v), ...TUNE_LIMITS.z); return { gcode_move: { homing_origin: ho } }
    case 'zreset': ho[2] = 0; return { gcode_move: { homing_origin: ho } }
    case 'speed': return { gcode_move: { speed_factor: clamp(v, ...TUNE_LIMITS.speed) / 100 } }
    case 'flow': return { gcode_move: { extrude_factor: clamp(v, ...TUNE_LIMITS.flow) / 100 } }
    case 'fan': return { fan: { speed: clamp(v, ...TUNE_LIMITS.fan) / 100 } }
    default: return {}
  }
}

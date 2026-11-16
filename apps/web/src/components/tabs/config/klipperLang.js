// Мова конфігурації Klipper для CodeMirror 6: підсвітка, коментарі (#), згортання розділів, перевірка,
// автодоповнення розділів і параметрів, список розділів для переходу.
//
// Синтаксис printer.cfg: [розділ], «ключ: значення» (або «ключ = значення»), багаторядкові значення з відступом
// (G-code макросів із Jinja), коментарі # і ; (у значенні — після пробілу), блок SAVE_CONFIG із рядками #*#.
import { StreamLanguage, HighlightStyle, foldService, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { linter } from '@codemirror/lint'

// ---------------------------------------------------------------- підсвітка
const parser = {
  name: 'klipper',
  startState: () => ({ gcode: false, value: false }),
  copyState: s => ({ ...s }),
  token(stream, st) {
    if (stream.sol()) {
      st.value = false
      // SAVE_CONFIG: рядки #*# — дані, які пише сам Klipper
      if (stream.match(/^#\*#.*/)) return 'meta'
      if (stream.match(/^\s*[#;].*/)) return 'comment'
      if (stream.match(/^\[[^\]]*\]/)) { st.gcode = false; return 'heading' }
      // Ключ на початку рядка (без відступу)
      const m = stream.match(/^([A-Za-z_][\w.-]*(?:\s+[\w.-]+)*?)(?=\s*[:=])/)
      if (m) { st.gcode = /(^|_)gcode$/.test(m[1].trim()) || m[1].trim() === 'gcode'; return 'propertyName' }
      // Рядок з відступом — продовження значення (у макросі — G-code)
      if (st.gcode && stream.match(/^\s+(?=[A-Za-z_])/)) {
        if (stream.match(/^[GMT]\d+(\.\d+)?\b/) || stream.match(/^[A-Z][A-Z0-9_]{2,}\b/)) return 'keyword'
        return null
      }
    }
    if (stream.eatSpace()) return null
    // Коментар усередині рядка (після пробілу)
    if ((stream.peek() === '#' || stream.peek() === ';') && /\s/.test(stream.string.charAt(stream.pos - 1) || ' ')) { stream.skipToEnd(); return 'comment' }
    if (stream.match(/^[:=]/) && !st.value) { st.value = true; return 'operator' }
    // Jinja: {% … %}, {{ … }}, { … }
    if (stream.match(/^\{%.*?%\}/) || stream.match(/^\{\{.*?\}\}/) || stream.match(/^\{[^{}]*\}/)) return 'macroName'
    // Піни: ^!PA1, EBBCan:PB3, ^gpio12
    if (stream.match(/^[!^~]*(?:[A-Za-z_]\w*:)?(?:P[A-K]\d{1,2}|gpio\d+)\b/)) return 'atom'
    if (stream.match(/^-?\d+(\.\d+)?\b/)) return 'number'
    if (stream.match(/^(true|false|True|False)\b/)) return 'bool'
    if (st.gcode && (stream.match(/^[GMT]\d+(\.\d+)?\b/) || stream.match(/^[A-Z][A-Z0-9_]{2,}\b/))) return 'keyword'
    stream.next()
    return st.value ? 'string' : null
  },
  languageData: { commentTokens: { line: '#' }, indentOnInput: /^\s*\[/ }
}
export const klipperLanguage = StreamLanguage.define(parser)

// Кольори — ті самі, що були у Vyron, плюс окремі для пінів, чисел, G-code й Jinja
const style = HighlightStyle.define([
  { tag: t.comment, color: '#6b717b', fontStyle: 'italic' },
  { tag: t.meta, color: '#4f5560' },
  { tag: t.heading, color: 'var(--coral)', fontWeight: '600' },
  { tag: t.propertyName, color: '#f2f4f5' },
  { tag: t.operator, color: '#8e939b' },
  { tag: t.string, color: '#ffb0a8' },
  { tag: t.number, color: '#ffd28a' },
  { tag: t.bool, color: '#ffd28a' },
  { tag: t.atom, color: '#7fd8ff' },
  { tag: t.keyword, color: '#ffffff', fontWeight: '600' },
  { tag: t.macroName, color: '#c9a3ff' }
])
export const klipperHighlight = syntaxHighlighting(style)

// ---------------------------------------------------------------- розділи
const SECTION = /^\[([^\]]+)\]/

/** Список розділів: [{ name, line, from }] — для переходу й згортання */
export function outline(doc) {
  const out = []
  for (let i = 1; i <= doc.lines; i++) {
    const l = doc.line(i), m = SECTION.exec(l.text)
    if (m) out.push({ name: m[1].trim(), line: i, from: l.from })
  }
  return out
}

/** Згортання: від заголовка розділу до останнього непорожнього рядка перед наступним розділом */
export const klipperFold = foldService.of((state, from) => {
  const line = state.doc.lineAt(from)
  if (!SECTION.test(line.text)) return null
  let end = line.number, last = line.number
  while (end < state.doc.lines) {
    const next = state.doc.line(end + 1)
    if (SECTION.test(next.text) || next.text.startsWith('#*#')) break
    end++
    if (next.text.trim()) last = end
  }
  if (last === line.number) return null
  return { from: line.to, to: state.doc.line(last).to }
})

// ---------------------------------------------------------------- перевірка
/**
 * Те, що Klipper гарантовано відхилить або що майже напевно помилка:
 * однакові розділи, параметр поза розділом, рядок без «:», однаковий параметр двічі в розділі.
 */
export function klipperLinter(t) {
  return linter(view => {
    const doc = view.state.doc, out = []
    const seen = new Map()
    let section = null, keys = new Map(), inSave = false, inValue = false
    for (let i = 1; i <= doc.lines; i++) {
      const l = doc.line(i), s = l.text
      if (s.startsWith('#*#')) { inSave = true; continue }
      if (inSave) continue
      if (!s.trim() || /^\s*[#;]/.test(s)) continue
      const m = SECTION.exec(s)
      if (m) {
        const name = m[1].trim().toLowerCase()
        if (seen.has(name)) out.push({ from: l.from, to: l.to, severity: 'error', message: t('ide.lint.dupSection', { l: seen.get(name) }) })
        else seen.set(name, i)
        section = name; keys = new Map(); inValue = false
        continue
      }
      if (/^\s/.test(s)) { if (!inValue) out.push({ from: l.from, to: l.to, severity: 'warning', message: t('ide.lint.indent') }); continue }
      const km = /^([A-Za-z_][\w.-]*(?:\s+[\w.-]+)*?)\s*[:=]/.exec(s)
      if (!km) { out.push({ from: l.from, to: l.to, severity: 'error', message: t('ide.lint.noColon') }); inValue = false; continue }
      if (!section) out.push({ from: l.from, to: l.to, severity: 'error', message: t('ide.lint.noSection') })
      const key = km[1].trim().toLowerCase()
      if (keys.has(key)) out.push({ from: l.from, to: l.from + km[1].length, severity: 'warning', message: t('ide.lint.dupKey', { l: keys.get(key) }) })
      else keys.set(key, i)
      inValue = true
    }
    return out
  }, { delay: 400 })
}

// ---------------------------------------------------------------- автодоповнення
const PIN = ['step_pin', 'dir_pin', 'enable_pin']
const STEPPER = [...PIN, 'microsteps', 'rotation_distance', 'full_steps_per_rotation', 'gear_ratio', 'endstop_pin', 'position_endstop', 'position_min', 'position_max', 'homing_speed', 'homing_retract_dist', 'homing_positive_dir', 'second_homing_speed']
const HEATER = ['sensor_type', 'sensor_pin', 'heater_pin', 'control', 'pid_kp', 'pid_ki', 'pid_kd', 'min_temp', 'max_temp', 'max_power', 'pullup_resistor', 'smooth_time', 'pwm_cycle_time']
const TMC = ['uart_pin', 'cs_pin', 'spi_bus', 'spi_software_sclk_pin', 'spi_software_mosi_pin', 'spi_software_miso_pin', 'run_current', 'hold_current', 'sense_resistor', 'stealthchop_threshold', 'interpolate', 'diag_pin', 'driver_sgthrs', 'diag1_pin', 'driver_sgt']
const FAN = ['pin', 'max_power', 'kick_start_time', 'off_below', 'cycle_time', 'hardware_pwm', 'shutdown_speed', 'tachometer_pin']

/** Розділи Klipper і їхні типові параметри (найуживаніші — не вичерпний довідник) */
export const SECTIONS = {
  mcu: ['serial', 'canbus_uuid', 'canbus_interface', 'baud', 'restart_method'],
  printer: ['kinematics', 'max_velocity', 'max_accel', 'minimum_cruise_ratio', 'square_corner_velocity', 'max_z_velocity', 'max_z_accel'],
  stepper_x: STEPPER, stepper_y: STEPPER, stepper_z: STEPPER, stepper_z1: STEPPER, stepper_z2: STEPPER, stepper_z3: STEPPER,
  extruder: [...PIN, 'microsteps', 'rotation_distance', 'gear_ratio', 'nozzle_diameter', 'filament_diameter', 'max_extrude_only_distance', 'max_extrude_cross_section', 'pressure_advance', 'pressure_advance_smooth_time', ...HEATER],
  heater_bed: HEATER,
  'tmc2209 stepper_x': TMC, 'tmc2209 extruder': TMC, 'tmc5160 stepper_x': TMC, 'tmc2240 stepper_x': TMC,
  fan: FAN, heater_fan: [...FAN, 'heater', 'heater_temp', 'fan_speed'], controller_fan: [...FAN, 'idle_timeout', 'idle_speed', 'heater', 'stepper'],
  fan_generic: FAN, temperature_fan: [...FAN, 'sensor_type', 'sensor_pin', 'min_temp', 'max_temp', 'target_temp', 'control'],
  temperature_sensor: ['sensor_type', 'sensor_pin', 'min_temp', 'max_temp', 'gcode_id'],
  probe: ['pin', 'x_offset', 'y_offset', 'z_offset', 'speed', 'samples', 'sample_retract_dist', 'samples_result', 'samples_tolerance', 'samples_tolerance_retries', 'lift_speed'],
  bltouch: ['sensor_pin', 'control_pin', 'x_offset', 'y_offset', 'z_offset', 'speed', 'samples', 'stow_on_each_sample', 'probe_with_touch_mode'],
  safe_z_home: ['home_xy_position', 'speed', 'z_hop', 'z_hop_speed', 'move_to_previous'],
  bed_mesh: ['speed', 'horizontal_move_z', 'mesh_min', 'mesh_max', 'probe_count', 'algorithm', 'fade_start', 'fade_end', 'zero_reference_position', 'mesh_pps', 'bicubic_tension'],
  quad_gantry_level: ['gantry_corners', 'points', 'speed', 'horizontal_move_z', 'retries', 'retry_tolerance', 'max_adjust'],
  z_tilt: ['z_positions', 'points', 'speed', 'horizontal_move_z', 'retries', 'retry_tolerance'],
  input_shaper: ['shaper_type_x', 'shaper_freq_x', 'shaper_type_y', 'shaper_freq_y', 'damping_ratio_x', 'damping_ratio_y'],
  adxl345: ['cs_pin', 'spi_bus', 'axes_map', 'rate'],
  resonance_tester: ['accel_chip', 'probe_points', 'min_freq', 'max_freq', 'accel_per_hz', 'hz_per_sec'],
  firmware_retraction: ['retract_length', 'retract_speed', 'unretract_extra_length', 'unretract_speed'],
  idle_timeout: ['timeout', 'gcode'],
  virtual_sdcard: ['path', 'on_error_gcode'],
  filament_switch_sensor: ['switch_pin', 'pause_on_runout', 'runout_gcode', 'insert_gcode', 'event_delay', 'pause_delay'],
  gcode_macro: ['gcode', 'description', 'rename_existing', 'variable_'],
  delayed_gcode: ['gcode', 'initial_duration'],
  save_variables: ['filename'],
  include: [], pause_resume: ['recover_velocity'], display_status: [], exclude_object: [], gcode_arcs: ['resolution'],
  respond: ['default_type', 'default_prefix'], force_move: ['enable_force_move'], skew_correction: [], endstop_phase: [],
  'temperature_sensor host': ['sensor_type'], neopixel: ['pin', 'chain_count', 'color_order', 'initial_RED', 'initial_GREEN', 'initial_BLUE'],
  output_pin: ['pin', 'pwm', 'value', 'shutdown_value', 'cycle_time'], board_pins: ['aliases'],
  'mcu rpi': ['serial'], 'mcu EBBCan': ['canbus_uuid']
}
const SECTION_NAMES = Object.keys(SECTIONS)
const baseOf = s => (SECTIONS[s] ? s : s.split(/\s+/)[0])

/** Автодоповнення: на початку рядка в «[» — назви розділів, у розділі — його параметри */
export function klipperCompletion(context) {
  const line = context.state.doc.lineAt(context.pos)
  const before = line.text.slice(0, context.pos - line.from)
  // [розділ
  const sm = /^\[([\w ]*)$/.exec(before)
  if (sm) {
    return {
      from: line.from + 1,
      options: SECTION_NAMES.map(n => ({ label: n, type: 'class', apply: n + ']' })),
      validFor: /^[\w ]*$/
    }
  }
  // ключ на початку рядка
  const km = /^([A-Za-z_]\w*)$/.exec(before)
  if (!km && !(context.explicit && before === '')) return null
  // Поточний розділ — найближчий заголовок вище
  let sec = null
  for (let i = line.number - 1; i >= 1; i--) {
    const m = SECTION.exec(context.state.doc.line(i).text)
    if (m) { sec = m[1].trim(); break }
  }
  if (!sec) return null
  const keys = SECTIONS[sec] || SECTIONS[baseOf(sec)] || []
  if (!keys.length) return null
  return {
    from: km ? line.from : context.pos,
    options: keys.map(k => ({ label: k, type: 'property', apply: k.endsWith('_') ? k : k + ': ' })),
    validFor: /^\w*$/
  }
}

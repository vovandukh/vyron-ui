// Стан принтера для Vyron Screen: легка версія без 3D і демо-моделі вебінтерфейсу.
// З'єднання, розбір помилок Klipper, тема й переклади — спільні (@vyron/shared), як і у Vyron Web.
import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef } from 'vue'
import { MoonrakerClient, resolveHost } from '@vyron/shared/moonraker/client'
import { classify } from '@vyron/shared/klipper/errors'
import { findChamber } from '@vyron/shared/klipper/objects'
import { applyDesign, sanitizeDesign, PRESETS } from '@vyron/shared/theme'
import { startDemo, demoCall } from './demo'

/** Об'єкти Klipper, потрібні екрану (мінімум — кожне поле оновлюється по WebSocket) */
const BASE = {
  print_stats: ['state', 'filename', 'print_duration', 'info', 'message'],
  virtual_sdcard: ['progress', 'is_active'],
  display_status: ['progress'],
  extruder: ['temperature', 'target'],
  heater_bed: ['temperature', 'target'],
  webhooks: ['state', 'state_message'],
  toolhead: ['homed_axes']
}
const DESIGN = { namespace: 'vyron_ui', key: 'design' }

export const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo')

export const usePrinter = defineStore('printer', () => {
  /** idle | connecting | open | lost */
  const link = ref('idle')
  const host = ref('')
  /** Klippy: ready | startup | shutdown | error | disconnected */
  const klippy = reactive({ state: 'disconnected', message: '', info: null })
  const st = reactive({})
  const chamber = ref(null)
  const busy = ref('')
  const design = shallowRef(sanitizeDesign(null))
  let client = null

  // ---------- навігація: стек сторінок (home → settings → wifi …) ----------
  const stack = ref(['home'])
  const page = computed(() => stack.value[stack.value.length - 1])
  /** Напрямок останнього переходу — для анімації (вперед / назад) */
  const dir = ref('fwd')
  const go = name => { dir.value = 'fwd'; stack.value = [...stack.value, name] }
  const back = () => { if (stack.value.length > 1) { dir.value = 'back'; stack.value = stack.value.slice(0, -1) } }
  const home = () => { dir.value = 'back'; stack.value = ['home'] }

  // ---------- похідні значення для екрана ----------
  const ps = computed(() => st.print_stats || {})
  const printState = computed(() => ps.value.state || 'standby')
  const active = computed(() => printState.value === 'printing' || printState.value === 'paused')
  const progress = computed(() => {
    const p = (st.display_status || {}).progress || (st.virtual_sdcard || {}).progress || 0
    return Math.max(0, Math.min(1, p))
  })
  /** Залишок, секунд: за фактичним часом друку і прогресом (null, поки даних замало) */
  const remaining = computed(() => {
    const d = ps.value.print_duration || 0, p = progress.value
    return printState.value === 'printing' && p > 0.01 && d > 0 ? d / p - d : null
  })
  const layer = computed(() => {
    const i = ps.value.info || {}
    return i.total_layer ? { n: i.current_layer || 0, total: i.total_layer } : null
  })
  const heaters = computed(() => {
    const list = [
      { id: 'extruder', key: 'status.nozzleShort', icon: 'nozzle', ...(st.extruder || {}) },
      { id: 'heater_bed', key: 'status.bed', icon: 'bed', ...(st.heater_bed || {}) }
    ]
    if (chamber.value && st[chamber.value]) list.push({ id: chamber.value, key: 'status.chamber', icon: 'chamber', ...st[chamber.value], target: undefined })
    return list
  })

  // ---------- стан Klipper ----------
  function setKlippy(state, message = '') {
    klippy.state = state
    klippy.message = message
    klippy.info = state === 'shutdown' || state === 'error' ? classify(message) : null
  }

  function merge(status) {
    for (const [k, v] of Object.entries(status || {})) st[k] = { ...(st[k] || {}), ...v }
    const w = status && status.webhooks
    if (w && w.state) setKlippy(w.state, w.state_message || '')
  }

  // ---------- виклики Moonraker (у демо — імітація) ----------
  function call(method, params = {}) {
    if (DEMO) return demoCall(method, params, { emitGcode })
    if (!client) return Promise.reject(new Error('not connected'))
    return client.call(method, params)
  }
  const gcode = script => call('printer.gcode.script', { script })

  /** Підписка на відповіді G-code (рядки консолі) — для WIFI_SCAN тощо; повертає функцію відписки */
  const gcodeListeners = new Set()
  function onGcode(fn) { gcodeListeners.add(fn); return () => gcodeListeners.delete(fn) }
  function emitGcode(line) { gcodeListeners.forEach(fn => fn(line)) }

  async function refresh() {
    try {
      const p = await client.call('printer.info')
      setKlippy(p.state, p.state_message || '')
      if (p.state === 'ready') await subscribe()
    } catch { setKlippy('disconnected') }
  }

  async function subscribe() {
    const objs = { ...BASE }
    try {
      const list = (await client.call('printer.objects.list')).objects || []
      chamber.value = findChamber(list)
      if (chamber.value) objs[chamber.value] = ['temperature']
    } catch { chamber.value = null }
    const r = await client.call('printer.objects.subscribe', { objects: objs })
    merge(r.status)
  }

  // ---------- тема: спільна з Vyron Web через базу Moonraker ----------
  function useDesign(d) {
    design.value = sanitizeDesign(d)
    applyDesign(design.value)
  }
  async function pullDesign() {
    try {
      const r = await call('server.database.get_item', DESIGN)
      useDesign(r && r.value)
    } catch { /* тему ще ніхто не зберігав — лишається стандартна */ }
  }
  /** Вибір пресета на екрані: застосовується одразу й записується в базу — підхоплять усі пристрої */
  async function setPreset(id) {
    const p = PRESETS.find(x => x.id === id)
    if (!p) return
    useDesign({ ...design.value, preset: p.id, accent: p.accent, brand: p.brand, updated: Date.now() })
    try { await call('server.database.post_item', { ...DESIGN, value: { ...design.value } }) } catch { /* лишається локально до наступного підключення */ }
  }

  function onNotify(method, params) {
    switch (method) {
      case 'notify_status_update': merge(params[0]); break
      case 'notify_gcode_response': emitGcode(params[0] || ''); break
      case 'notify_klippy_ready': refresh(); break
      case 'notify_klippy_shutdown': refresh(); break
      case 'notify_klippy_disconnected': setKlippy('disconnected'); break
      case 'notify_agent_event': {
        const e = params[0] || {}
        if (e.agent === 'vyron-core' && e.event === 'design_changed' && (e.data || {}).updated !== design.value.updated) pullDesign()
        break
      }
    }
  }

  function onState(s) {
    if (s === 'connecting') link.value = 'connecting'
    else if (s === 'open') { link.value = 'open'; refresh(); pullDesign() }
    else if (s === 'lost') link.value = 'lost'
  }

  function start() {
    if (DEMO) {
      link.value = 'open'
      startDemo({ merge, setKlippy })
      // ?demo&page=wifi — одразу відкрити сторінку налаштувань (для розробки)
      const pg = new URLSearchParams(location.search).get('page')
      if (pg) stack.value = pg === 'settings' ? ['home', 'settings'] : ['home', 'settings', pg]
      return
    }
    host.value = resolveHost()
    if (!host.value) { link.value = 'idle'; return }
    client = new MoonrakerClient({ onState, onNotify })
    client.connect(host.value)
  }

  // ---------- дії (кнопки екрана) ----------
  async function run(name, method, params = {}) {
    if (DEMO || !client) return
    busy.value = name
    try { await client.call(method, params) } catch { /* помилку покаже Klipper (state_message) */ } finally { busy.value = '' }
  }
  const pause = () => run('pause', 'printer.print.pause')
  const resume = () => run('resume', 'printer.print.resume')
  const cancel = () => run('cancel', 'printer.print.cancel')
  const firmwareRestart = () => run('fw', 'printer.firmware_restart')
  const restart = () => run('restart', 'printer.restart')
  const restartMoonraker = () => run('moonraker', 'machine.services.restart', { service: 'moonraker' })
  const reboot = () => run('reboot', 'machine.reboot')
  const shutdown = () => run('shutdown', 'machine.shutdown')
  /** Аварійна зупинка — без очікування відповіді, як у вебінтерфейсі */
  function estop() {
    if (DEMO) { setKlippy('shutdown', 'Shutdown due to M112 command'); return }
    client && client.fire('printer.emergency_stop')
  }

  return {
    link, host, klippy, st, printState, active, progress, remaining, layer, heaters, busy, design,
    stack, page, dir, go, back, home,
    call, gcode, onGcode, setPreset,
    start, pause, resume, cancel, estop, firmwareRestart, restart, restartMoonraker, reboot, shutdown
  }
})

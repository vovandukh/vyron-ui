// Стан принтера для Vyron Screen: легка версія без 3D і демо-моделі вебінтерфейсу.
// З'єднання, розбір помилок Klipper, тема й переклади — спільні (@vyron/shared), як і у Vyron Web.
import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { MoonrakerClient, resolveHost } from '@vyron/shared/moonraker/client'
import { fetchGcode } from '@vyron/shared/moonraker/api'
import { classify } from '@vyron/shared/klipper/errors'
import { findChamber, findLeveling } from '@vyron/shared/klipper/objects'
import { applyDesign, sanitizeDesign, PRESETS } from '@vyron/shared/theme'
import { parseGcode } from '@vyron/shared/gcode/parser'
import { model, loadModel, indexForPos } from '@vyron/shared/gcode/model'
import { startDemo, demoCall, demoGcode, setDemoUpdateSink } from './demo'
import { watchDesign, handleCoreEvent } from '@vyron/shared/live'

/** Найбільший G-code, який екран розбирає для візуалізації: на CB1 лише 1 ГБ пам'яті, Klipper важливіший */
const MAX_GCODE_BYTES = 20 * 1024 * 1024

/** Об'єкти Klipper, потрібні екрану (мінімум — кожне поле оновлюється по WebSocket) */
const BASE = {
  print_stats: ['state', 'filename', 'print_duration', 'info', 'message'],
  virtual_sdcard: ['progress', 'is_active', 'file_position'],
  display_status: ['progress'],
  extruder: ['temperature', 'target'],
  heater_bed: ['temperature', 'target'],
  webhooks: ['state', 'state_message'],
  toolhead: ['homed_axes', 'position']
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
  const hostname = ref('')
  /** Останнє завдання з історії Moonraker: { filename, status, print_duration } | null; undefined — історія недоступна */
  const lastJob = ref(undefined)
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
    const s = status && status.print_stats && status.print_stats.state
    if (s) printEvent(s)
    const w = status && status.webhooks
    if (w && w.state) setKlippy(w.state, w.state_message || '')
  }

  // ---------- виклики Moonraker (у демо — імітація) ----------
  function call(method, params = {}) {
    if (DEMO) return demoCall(method, params, { emitGcode, merge })
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
      hostname.value = p.hostname || ''
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
      leveling.value = findLeveling(list)
      if (leveling.value) objs[leveling.value.obj] = ['applied']
    } catch { chamber.value = null }
    const r = await client.call('printer.objects.subscribe', { objects: objs })
    merge(r.status)
    loadLastJob()
  }

  /** Лише читання: server.history.list (якщо в moonraker.conf немає [history] — просто нічого не показуємо) */
  async function loadLastJob() {
    try {
      const r = await call('server.history.list', { limit: 1, order: 'desc' })
      lastJob.value = (r.jobs || [])[0] || null
    } catch { lastJob.value = undefined }
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
      case 'notify_update_response': updateLine(params[0] || {}); break
      case 'notify_update_refreshed': updates.info = (params[0] || {}).version_info || updates.info; break
      case 'notify_klippy_ready': refresh(); break
      case 'notify_klippy_shutdown': refresh(); break
      case 'notify_klippy_disconnected': setKlippy('disconnected'); break
      case 'notify_agent_event': {
        const e = params[0] || {}
        // Vyron Core: тема змінилась — підтягнути одразу; нова збірка — перевірити й тихо перезавантажитись
        handleCoreEvent(e, { onDesign: u => { if (u !== design.value.updated) pullDesign() } })
        break
      }
    }
  }

  // Тема, змінена у вебінтерфейсі, з'являється на екрані без перезавантаження (опитування позначки часу)
  let stopLive = null
  function onState(s) {
    if (s === 'connecting') link.value = 'connecting'
    else if (s === 'open') {
      link.value = 'open'; refresh(); pullDesign()
      stopLive && stopLive()
      stopLive = watchDesign({ call, getUpdated: () => design.value.updated, onChange: pullDesign, visibleOnly: false })
    } else if (s === 'lost') { link.value = 'lost'; stopLive && stopLive(); stopLive = null }
  }

  function start() {
    if (DEMO) {
      link.value = 'open'
      leveling.value = { obj: 'quad_gantry_level', kind: 'qgl' }
      startDemo({ merge, setKlippy })
      hostname.value = 'vyron-demo'
      loadLastJob()
      // ?demo&page=wifi — одразу відкрити сторінку налаштувань (для розробки)
      const pg = new URLSearchParams(location.search).get('page')
      if (pg) stack.value = pg === 'settings' || pg === 'move' ? ['home', pg] : ['home', 'settings', pg]
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

  // ---------- рух: home, вирівнювання порталу, мотори, переміщення ----------
  /** Об'єкт вирівнювання: { obj: 'quad_gantry_level', kind: 'qgl' } або z_tilt; null — немає */
  const leveling = ref(null)
  const homed = computed(() => String((st.toolhead || {}).homed_axes || ''))
  const position = computed(() => (st.toolhead || {}).position || null)
  const leveled = computed(() => (leveling.value ? !!(st[leveling.value.obj] || {}).applied : null))
  /** Поточна дія руху: '' | 'home' | 'level' | 'motors' | 'jog' */
  const moving = ref('')
  const FEED = { xy: 3000, z: 600 }

  /** G-code руху з показом помилки Klipper у «пігулці» (напр. «Спершу потрібно знайти нуль осей») */
  async function motion(kind, script) {
    if (moving.value || active.value) return
    moving.value = kind
    try { await gcode(script) } catch (e) {
      const i = classify(String((e && e.message) || ''))
      flash(i.id === 'generic' ? 'state.error' : 'kerr.' + i.id + '.t', 'red', i.params)
    } finally { moving.value = '' }
  }
  const homeAll = () => motion('home', 'G28')
  const motorsOff = () => motion('motors', 'M84')
  /** Як у Vyron Web: не захомлено — спершу G28; після вирівнювання висота змінюється — G28 Z */
  function level() {
    const lv = leveling.value
    if (!lv) return
    const all = /x/.test(homed.value) && /y/.test(homed.value) && /z/.test(homed.value)
    motion('level', (all ? '' : 'G28\n') + (lv.kind === 'ztilt' ? 'Z_TILT_ADJUST' : 'QUAD_GANTRY_LEVEL') + '\nG28 Z')
  }
  /** Відносне переміщення осі на dist мм (G91 → G1 → G90) */
  function jog(axis, dist) {
    const f = axis === 'z' ? FEED.z : FEED.xy
    motion('jog', 'G91\nG1 ' + axis.toUpperCase() + dist + ' F' + f + '\nG90')
  }
  const shutdown = () => run('shutdown', 'machine.shutdown')
  /** Аварійна зупинка — без очікування відповіді, як у вебінтерфейсі */
  function estop() {
    if (DEMO) { setKlippy('shutdown', 'Shutdown due to M112 command'); return }
    client && client.fire('printer.emergency_stop')
  }

  // ---------- візуалізація G-code поточного друку ----------
  /** none | loading | ready | big (файл завеликий для екрана) | error */
  const gcodeState = ref('none')
  /** Лічильник версій моделі: великі масиви живуть поза реактивністю (shared/gcode/model) */
  const modelVer = ref(0)
  let loadedName = ''
  const filename = computed(() => ps.value.filename || '')
  /** Скільки сегментів моделі вже надруковано */
  const done = computed(() => {
    modelVer.value // залежність: нова модель — новий підрахунок
    if (gcodeState.value !== 'ready' || !model.N) return 0
    if (!active.value && printState.value === 'complete') return model.N
    if (DEMO) return Math.floor(progress.value * model.N)
    const pos = (st.virtual_sdcard || {}).file_position
    return pos == null ? 0 : indexForPos(pos)
  })
  async function loadGcode(fn) {
    loadedName = fn
    gcodeState.value = 'loading'
    try {
      if (DEMO) loadModel(...demoGcode())
      else {
        const meta = await call('server.files.metadata', { filename: fn }).catch(() => ({}))
        if (meta.size > MAX_GCODE_BYTES) { gcodeState.value = 'big'; return }
        const { P, F, T } = parseGcode(await fetchGcode(host.value, fn))
        if (loadedName !== fn) return
        loadModel(P, F, T)
      }
      modelVer.value++
      gcodeState.value = model.N ? 'ready' : 'error'
    } catch { if (loadedName === fn) gcodeState.value = 'error' }
  }
  /** Модель показується під час друку і після завершення (готова деталь), поки не почнеться наступний друк */
  const showModel = computed(() => active.value || printState.value === 'complete')
  watch([filename, showModel], ([fn, on]) => { if (fn && on && fn !== loadedName) loadGcode(fn) })

  // ---------- події для «пігулки» у верхній смузі (як Dynamic Island у вебінтерфейсі) ----------
  const event = ref(null)
  let eventTimer = 0
  function flash(key, tone, params) {
    clearTimeout(eventTimer)
    event.value = { key, tone, params, at: Date.now() }
    eventTimer = setTimeout(() => { event.value = null }, 3200)
  }
  const PRINT_EVENTS = {
    printing: ['island.printStart', 'brand'], complete: ['island.printDone', 'green'], paused: ['island.paused', 'amber'],
    cancelled: ['island.cancelled', 'dim'], error: ['island.printError', 'red']
  }
  // Лише справжня зміна стану друку: перший отриманий стан (при запуску екрана) подією не вважається
  let lastPrint = null
  function printEvent(s) {
    const o = lastPrint
    lastPrint = s
    if (!o || s === o || (s === 'printing' && o === 'paused')) return
    if (s === 'complete' || s === 'cancelled' || s === 'error') setTimeout(loadLastJob, 1500)
    const e = PRINT_EVENTS[s]
    if (e) flash(...e)
  }
  watch(() => klippy.state, (s, o) => {
    if (!o || s === o) return
    if (s === 'ready' && o !== 'disconnected') flash('island.ready', 'green')
    else if (s === 'shutdown' || s === 'error') flash('island.klipperError', 'red')
  })

  // ---------- оновлення (Moonraker update_manager) ----------
  const updates = reactive({ info: {}, busy: false, checking: false, log: [] })
  function updateLine(r) {
    if (r.message) updates.log = [...updates.log.slice(-40), String(r.message).trim()]
    updates.busy = !r.complete
    if (r.complete) refreshUpdates(false)
  }
  async function refreshUpdates(remote) {
    updates.checking = !!remote
    try {
      const r = remote ? await call('machine.update.refresh', {}) : await call('machine.update.status', {})
      updates.info = (r && r.version_info) || {}
      if (!remote) updates.busy = !!(r && r.busy)
    } catch { /* лишаємо попередній стан */ } finally { updates.checking = false }
  }
  /** name: компонент update_manager, 'system' (пакети ОС) або '*' (усе) */
  async function runUpdate(name) {
    updates.busy = true
    updates.log = []
    const m = name === '*' ? 'machine.update.full' : name === 'system' ? 'machine.update.system'
      : name === 'klipper' ? 'machine.update.klipper' : name === 'moonraker' ? 'machine.update.moonraker' : 'machine.update.client'
    try { await call(m, m === 'machine.update.client' ? { name } : {}) } catch (e) {
      updates.log = [...updates.log, String((e && e.message) || e)]
      updates.busy = false
    }
  }
  if (DEMO) setDemoUpdateSink(updateLine)

  return {
    gcodeState, modelVer, done, filename, showModel, event, updates, refreshUpdates, runUpdate,
    link, host, hostname, lastJob, klippy, st, printState, active, progress, remaining, layer, heaters, busy, design,
    stack, page, dir, go, back, home,
    call, gcode, onGcode, setPreset,
    leveling, homed, position, leveled, moving, homeAll, motorsOff, level, jog,
    start, pause, resume, cancel, estop, firmwareRestart, restart, restartMoonraker, reboot, shutdown
  }
})

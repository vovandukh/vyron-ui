import { defineStore } from 'pinia'
import { ref, shallowReactive, computed } from 'vue'
import { MoonrakerClient, normalizeHost } from '../services/moonrakerClient'
import { fetchGcode } from '../services/moonrakerApi'
import { discoverTools, subscriptionObjects, STATE_KEYS, toolNum } from '../services/klipper'
import { detectToolheads, toolheadObjects } from '../services/toolheads'
import { parseGcode } from '../services/gcodeParser'
import { model, loadModel, indexForPos, segEnd, layerLabel } from '../services/gcodeModel'
import {
  DEMO_DEFAULT_TOOLS, DEMO_MAX_TOOLS, DEMO_STEP, DEMO_INTERVAL, demoTools, demoToolheads,
  demoGcode, demoStaticStatus, demoTickStatus
} from '../services/demo'

const LOG_MAX = 500

/**
 * Повідомлення в UI зберігаються як { key, params } (перекладаються в компонентах)
 * або { raw } для тексту, що прийшов з принтера.
 */
export const usePrinterStore = defineStore('printer', () => {
  // ---------- з'єднання ----------
  const host = ref(null)
  const demoMode = ref(false)
  /** idle | connecting | open | ready | shutdown | lost | demo */
  const link = ref('idle')
  const metaOverride = ref(null)
  const gcodeError = ref(null)

  // ---------- стан Klipper ----------
  /** Об'єкти статусу Klipper ('print_stats', 'extruder', …). Кожен ключ замінюється цілком при оновленні. */
  const st = shallowReactive({})
  const objectList = ref([])
  const toolObjects = ref([])
  /** Запасні датчики плат за назвою: { номер голови: об'єкт } */
  const boardObjects = ref({})
  const hostname = ref(null)
  /** Плата голови для кожного екструдера: { extruder: Toolhead | null } (див. services/toolheads.js) */
  const toolheads = ref({})
  const activeTool = ref(0)
  const toolStatus = ref({ key: 'tools.waiting' })
  const ctlMsg = ref(null)

  // ---------- консоль ----------
  const consoleLines = ref([])
  const cmdHistory = ref([])
  let lineId = 0

  // ---------- модель друку ----------
  const modelVersion = ref(0)
  const done = ref(0)
  let loadedName = null, loading = false, demoTimer = null

  // ---------- шина подій для компонентів ----------
  const listeners = new Map()
  function on(ev, fn) {
    if (!listeners.has(ev)) listeners.set(ev, new Set())
    listeners.get(ev).add(fn)
    return () => listeners.get(ev).delete(fn)
  }
  const emit = (ev, ...a) => listeners.get(ev)?.forEach(fn => fn(...a))

  const client = new MoonrakerClient({
    onState: handleState,
    onNotify: handleNotify,
    onRpcError: msg => log(msg, 'e'),
    onInvalid: () => log({ key: 'msg.invalidWs' }, 'e')
  })

  // ================= getters =================
  const connected = computed(() => ['open', 'ready', 'shutdown'].includes(link.value))
  const printState = computed(() => (st.print_stats || {}).state)
  /** Чи йде реальний друк (у демо — ні, щоб керування лишалось доступним). */
  const isPrinting = computed(() => !demoMode.value && printState.value === 'printing')

  const stateLabel = computed(() => {
    if (demoMode.value) return { key: 'state.demo' }
    switch (link.value) {
      case 'idle': return { key: 'state.standby' }
      case 'connecting': return { key: 'state.connecting' }
      case 'lost': return { key: 'state.lost' }
      case 'shutdown': return { key: 'state.klipperError' }
    }
    const s = printState.value
    if (s) return STATE_KEYS[s] ? { key: STATE_KEYS[s] } : { raw: s }
    return { key: link.value === 'ready' ? 'state.ready' : 'state.connected' }
  })

  const meta = computed(() => {
    if (demoMode.value) return { key: 'meta.demo' }
    if (metaOverride.value) return metaOverride.value
    const fn = (st.print_stats || {}).filename
    if (gcodeError.value && fn === gcodeError.value.name) return { key: 'meta.gcodeError', params: { msg: gcodeError.value.msg } }
    if (connected.value) return fn ? { raw: fn } : { key: 'meta.noFile' }
    return { key: 'meta.notConnected' }
  })

  /** Активна голова: реальний toolhead.extruder з Klipper, інакше останній вибір у UI. */
  const activeToolName = computed(() => {
    const ex = (st.toolhead || {}).extruder
    return ex && toolObjects.value.includes(ex) ? ex : toolObjects.value[activeTool.value] || null
  })
  /** Перемикання голів має сенс лише коли їх більше однієї. */
  const canSwitchTools = computed(() => toolObjects.value.length > 1)
  /** Назва для шапки/вкладки: hostname з printer.info. */
  const printerName = computed(() => (demoMode.value ? null : hostname.value))
  const nozzleTemp = computed(() => (activeToolName.value ? (st[activeToolName.value] || {}).temperature : null))
  const bedTemp = computed(() => (st.heater_bed || {}).temperature)
  const chamberTemp = computed(() => (st['temperature_sensor chamber'] || st['heater_generic chamber'] || {}).temperature)
  const speedFactor = computed(() => (st.gcode_move || {}).speed_factor)
  const fanSpeed = computed(() => (st.fan || {}).speed)
  const position = computed(() => (st.toolhead || {}).position || null)
  const qgl = computed(() => (st.quad_gantry_level || {}).applied)

  const progressPct = computed(() => {
    modelVersion.value
    return model.N ? Math.floor((done.value / model.N) * 100) : 0
  })

  /** Секунд до завершення або null. */
  const etaSeconds = computed(() => {
    const ps = st.print_stats || {}, sd = st.virtual_sdcard || {}
    if (ps.state !== 'printing' || !(sd.progress > 0.01)) return null
    const d = ps.print_duration || 0
    return d / sd.progress - d
  })

  const layerText = computed(() => {
    const info = (st.print_stats || {}).info || {}
    if (info.current_layer) return info.current_layer + ' / ' + (info.total_layer || '–')
    modelVersion.value
    return layerLabel(done.value)
  })

  /** Тип нагрівача для вікна температур сопла: активний екструдер з toolhead. */
  /** Нагрівач активного сопла; null, доки Klipper не повідомив жодного екструдера (без заглушки 'extruder'). */
  const nozzleHeater = computed(() => activeToolName.value)
  /** Кількість знайдених голів: 0 до відповіді Klipper (objects.list), далі — рівно стільки, скільки є. */
  const toolCount = computed(() => toolObjects.value.length)

  // ================= actions =================
  function log(t, cls) {
    let line
    if (typeof t === 'string') {
      emit('log', t)
      line = { id: ++lineId, text: t, cls: cls || (/^!!/.test(t) ? 'e' : '') }
    } else line = { id: ++lineId, msg: t, cls: cls || '' }
    const a = consoleLines.value
    a.push(line)
    if (a.length > LOG_MAX) a.splice(0, a.length - LOG_MAX)
  }

  function clearState() {
    for (const k of Object.keys(st)) delete st[k]
    objectList.value = []
    toolObjects.value = []
    boardObjects.value = {}
    toolheads.value = {}
    hostname.value = null
    loadedName = null
    loading = false
    gcodeError.value = null
    metaOverride.value = null
  }

  function stopDemo() {
    clearInterval(demoTimer)
    demoTimer = null
  }

  function connect(rawHost) {
    const h = normalizeHost(rawHost)
    if (!h) return
    stopDemo()
    demoMode.value = false
    clearState()
    host.value = h
    client.connect(h)
  }

  function handleState(s, info) {
    if (s === 'connecting') { link.value = 'connecting'; metaOverride.value = { key: 'conn.connectingTo', params: { host: info.host } } }
    else if (s === 'open') {
      link.value = 'open'
      metaOverride.value = { key: 'conn.connectedTo', params: { host: info.host } }
      initObjects()
      client.call('server.gcode_store', { count: 60 })
        .then(r => (r.gcode_store || []).forEach(x => log(x.message)))
        .catch(() => {})
    }
    else if (s === 'error') metaOverride.value = { key: 'conn.wsError' }
    else if (s === 'lost') { link.value = 'lost'; metaOverride.value = { key: 'conn.lost' } }
    else if (s === 'addrError') { link.value = 'idle'; metaOverride.value = { key: 'conn.addrError', params: { msg: info.message } } }
  }

  function handleNotify(method, params) {
    switch (method) {
      case 'notify_status_update': mergeStatus(params[0] || {}); break
      case 'notify_gcode_response': log(params[0] || ''); break
      case 'notify_klippy_ready': link.value = 'ready'; initObjects(); break
      case 'notify_klippy_shutdown': link.value = 'shutdown'; break
      case 'notify_history_changed': emit('history_changed'); break
      case 'notify_update_response': emit('update_response', params[0]); break
      case 'notify_update_refreshed': emit('update_refreshed', params[0] || {}); break
    }
  }

  async function initObjects() {
    try {
      const r = await client.call('printer.objects.list')
      objectList.value = r.objects || []
      const { tools, boards } = discoverTools(objectList.value)
      toolObjects.value = tools
      boardObjects.value = boards
      if (activeTool.value >= tools.length) activeTool.value = 0
      toolStatus.value = { key: 'tools.found', params: { n: tools.length } }
      // Назва принтера для шапки (тільки читання).
      client.call('printer.info').then(i => { hostname.value = (i && i.hostname) || null }).catch(() => {})
      // Плати голів: читаємо налаштування printer.cfg (тільки читання) і шукаємо MCU за пінами екструдерів.
      let extra = []
      try {
        const q = await client.call('printer.objects.query', { objects: { configfile: ['settings'] } })
        const settings = (((q || {}).status || {}).configfile || {}).settings || {}
        toolheads.value = detectToolheads(settings, tools, objectList.value)
        extra = toolheadObjects(toolheads.value)
      } catch { toolheads.value = {} }
      const s = await client.call('printer.objects.subscribe', { objects: subscriptionObjects(objectList.value, tools, boards, extra) })
      if (s && s.status) mergeStatus(s.status)
    } catch { /* помилку вже записано в консоль */ }
  }

  function mergeStatus(patch) {
    for (const k in patch) st[k] = Object.assign({}, st[k], patch[k])
    if (demoMode.value) return
    metaOverride.value = null
    maybeLoadGcode()
    const pos = (st.virtual_sdcard || {}).file_position
    if (model.P && pos != null && !loading) done.value = indexForPos(pos)
  }

  function applyModel({ P, F }) {
    loadModel(P, F)
    done.value = 0
    modelVersion.value++
  }

  async function maybeLoadGcode() {
    const fn = (st.print_stats || {}).filename
    if (!fn || fn === loadedName || loading || !host.value) return
    loading = true
    loadedName = fn
    gcodeError.value = null
    try {
      applyModel(parseGcode(await fetchGcode(host.value, fn)))
    } catch (e) {
      gcodeError.value = { name: fn, msg: e.message }
    } finally {
      loading = false
    }
    const pos = (st.virtual_sdcard || {}).file_position
    if (model.P && pos != null) done.value = indexForPos(pos)
  }

  /** Демо з n головами (1…DEMO_MAX_TOOLS). Без аргументу — ?demo=N з адреси або DEMO_DEFAULT_TOOLS. */
  function startDemo(n) {
    if (!(n >= 1)) n = Number(new URLSearchParams(location.search).get('demo')) || DEMO_DEFAULT_TOOLS
    n = Math.min(DEMO_MAX_TOOLS, Math.max(1, Math.round(n)))
    client.close()
    stopDemo()
    clearState()
    host.value = null
    demoMode.value = true
    link.value = 'demo'
    const tools = demoTools(n), heads = demoToolheads(tools)
    toolObjects.value = tools
    boardObjects.value = {}
    toolheads.value = heads
    activeTool.value = 0
    toolStatus.value = { key: 'tools.demoMode' }
    applyModel(demoGcode())
    mergeStatus(demoStaticStatus(heads))
    let k = 0
    demoTimer = setInterval(() => {
      k += DEMO_STEP
      if (k > model.N) k = 0
      done.value = indexForPos(k)
      mergeStatus(demoTickStatus({
        pos: done.value ? segEnd(done.value - 1) : null,
        progress: model.N ? done.value / model.N : 0,
        activeTool: activeTool.value,
        tools, toolheads: heads
      }))
    }, DEMO_INTERVAL)
  }

  /**
   * Автостарт: ?demo → демо; VITE_PRINTER_HOST → напряму до принтера;
   * інакше до хоста сторінки (на принтері це сам Moonraker/nginx, у dev — проксі Vite).
   * Демо вмикається ТІЛЬКИ явно (?demo або кнопка «Демо»): відкритий як файл застосунок
   * лишається непідключеним, з 0 голів, доки користувач не введе адресу принтера.
   */
  function autoStart() {
    const envHost = import.meta.env.VITE_PRINTER_HOST
    if (new URLSearchParams(location.search).has('demo')) startDemo()
    else if (envHost) connect(envHost)
    else if (location.protocol.startsWith('http') && location.host) connect(location.host)
  }

  /** G-code від кнопок керування. Повертає false і пише причину в ctlMsg, якщо команда не пішла. */
  function rpc(script) {
    if (demoMode.value || !client.connected) {
      ctlMsg.value = { key: demoMode.value ? 'msg.demoNoExec' : 'msg.notConnected' }
      return false
    }
    ctlMsg.value = null
    client.fire('printer.gcode.script', { script })
    return true
  }

  /** Сирий G-code без перевірки демо (Wi‑Fi макроси). */
  function sendRaw(script) {
    return client.fire('printer.gcode.script', { script })
  }

  function consoleSend(cmd) {
    cmd = cmd.trim()
    if (!cmd) return
    cmdHistory.value.push(cmd)
    log('> ' + cmd, 'c')
    if (demoMode.value || !client.connected) {
      log({ key: demoMode.value ? 'msg.demoNoExec' : 'msg.notConnectedPrinter' }, 'e')
      return
    }
    client.fire('printer.gcode.script', { script: cmd })
  }

  /** RPC з відповіддю для компонентів. */
  function call(method, params) {
    return client.call(method, params)
  }

  /** Вибір голови за позицією у toolObjects; надсилає T<номер з імені екструдера>. */
  function selectTool(i) {
    const name = toolObjects.value[i]
    if (!name || !canSwitchTools.value) return
    const n = toolNum(name)
    if (demoMode.value) {
      activeTool.value = i
      toolStatus.value = { key: 'tools.demoSelected', params: { i: n } }
      return
    }
    if (rpc('T' + n)) {
      activeTool.value = i
      toolStatus.value = { key: 'tools.sent', params: { i: n } }
    }
  }

  /** Ціль нагріву конкретного екструдера — працює з будь-якою кількістю голів без макросів T<n>. */
  function setToolTarget(name, v) {
    return rpc('SET_HEATER_TEMPERATURE HEATER=' + name + ' TARGET=' + v)
  }

  function setHeater(heater, v) {
    return client.call('printer.gcode.script', { script: 'SET_HEATER_TEMPERATURE HEATER=' + heater + ' TARGET=' + v })
  }

  function emergencyStop() {
    client.fire('printer.emergency_stop')
  }

  return {
    // state
    host, demoMode, link, st, objectList, toolObjects, boardObjects, toolheads, activeTool, toolStatus, ctlMsg,
    consoleLines, cmdHistory, modelVersion, done,
    // getters
    connected, isPrinting, printState, stateLabel, meta, activeToolName, canSwitchTools, toolCount, printerName, nozzleTemp, bedTemp, chamberTemp,
    speedFactor, fanSpeed, position, qgl, progressPct, etaSeconds, layerText, nozzleHeater,
    // actions
    on, log, connect, startDemo, autoStart, rpc, sendRaw, consoleSend, call, selectTool, setToolTarget,
    setHeater, emergencyStop, mergeStatus
  }
})

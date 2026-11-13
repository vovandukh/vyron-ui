<script setup>
import { ref, shallowRef, onActivated, onDeactivated } from 'vue'
import { usePrinterStore } from '../../stores/printerStore'
import { useConfirm } from '../../composables/useConfirm'
import { useI18n } from '../../composables/useI18n'
import { demoNetworks } from '../../services/demo'

const SCAN_TIMEOUT = 25000
const SCAN_IDLE = 1500

const printer = usePrinterStore()
const { confirm } = useConfirm()
const { t, tm } = useI18n()

const ifaces = shallowRef([])     // [{ name, ips }]
const ifaceDemo = ref(false)
const nets = shallowRef([])
const scanMsg = ref(null)
const scanning = ref(false)
const ssid = ref(''), pass = ref('')
const msg = ref(null)
const passEl = ref(null)

function loadNet() {
  if (printer.demoMode) { ifaceDemo.value = true; ifaces.value = []; return }
  ifaceDemo.value = false
  printer.call('machine.system_info', {}).then(r => {
    const n = ((r.system_info || {}).network) || {}
    ifaces.value = Object.keys(n).filter(k => k !== 'lo').map(k => ({
      name: k, ips: (n[k].ip_addresses || []).filter(a => a.family === 'ipv4').map(a => a.address).join(', ') || '–'
    }))
  }).catch(() => {})
}

// --- сканування: макрос WIFI_SCAN друкує рядки nmcli «SSID:SIGNAL:SECURITY» у консоль ---
let buf = [], timer = null, offLog = null

function feed(text) {
  String(text).split('\n').forEach(l => {
    const m = l.replace(/^\/\/\s*/, '').trim().match(/^((?:\\.|[^:\\])*):(\d{1,3}):(.*)$/)
    if (m) buf.push({ ssid: m[1].replace(/\\(.)/g, '$1'), sig: +m[2], sec: m[3] })
  })
  clearTimeout(timer)
  timer = setTimeout(finish, SCAN_IDLE)
}

function showNets(list) {
  const best = {}
  list.forEach(n => { if (n.ssid && (!best[n.ssid] || best[n.ssid].sig < n.sig)) best[n.ssid] = n })
  nets.value = Object.values(best).sort((a, b) => b.sig - a.sig)
  scanMsg.value = nets.value.length ? { key: 'net.found', params: { n: nets.value.length } } : { key: 'net.none' }
}

function finish() {
  scanning.value = false
  clearTimeout(timer)
  offLog?.(); offLog = null
  showNets(buf)
}

function scan() {
  if (printer.demoMode) { showNets(demoNetworks); return }
  if (!printer.connected) { scanMsg.value = { key: 'msg.notConnectedPrinter' }; return }
  if (printer.isPrinting) { scanMsg.value = { key: 'msg.notWhilePrinting' }; return }
  buf = []
  scanning.value = true
  scanMsg.value = { key: 'net.scanning' }
  offLog = printer.on('log', feed)
  clearTimeout(timer)
  timer = setTimeout(finish, SCAN_TIMEOUT)
  printer.sendRaw('WIFI_SCAN')
}

function pick(n) { ssid.value = n.ssid; passEl.value?.focus() }

async function connectWifi() {
  const s = ssid.value.trim(), p = pass.value
  if (!s || !p) { msg.value = { key: 'net.needBoth' }; return }
  if (/["'\\{}]/.test(s + p)) { msg.value = { key: 'net.badChars' }; return }
  if (printer.demoMode || !printer.connected) { msg.value = { key: 'msg.notConnectedPrinter' }; return }
  if (printer.isPrinting) { msg.value = { key: 'msg.notWhilePrinting' }; return }
  if (!(await confirm({ key: 'net.confirm', params: { ssid: s } }))) return
  printer.sendRaw('WIFI_CONNECT SSID="' + s + '" PASS="' + p + '"')
  pass.value = ''
  msg.value = { key: 'net.sent' }
}

onActivated(loadNet)
onDeactivated(() => { if (scanning.value) finish() })
</script>

<template>
  <section class="view net">
    <div class="lbl">{{ t('net.interfaces') }}</div>
    <div class="ifaces">
      <div v-if="ifaceDemo">{{ t('net.demoIface') }}</div>
      <div v-for="i in ifaces" :key="i.name">{{ i.name }} · {{ i.ips }}</div>
    </div>
    <div class="line">
      <button :disabled="scanning" @click="scan">{{ t('net.scan') }}</button>
      <span class="small">{{ tm(scanMsg) }}</span>
    </div>
    <div class="wfl">
      <button v-for="n in nets" :key="n.ssid" class="wfn" @click="pick(n)">
        <span>{{ n.ssid }}</span><span>{{ (n.sec && n.sec !== '--' ? n.sec : t('net.open')) + ' · ' + n.sig }}%</span>
      </button>
    </div>
    <div class="line wrap">
      <input v-model="ssid" :placeholder="t('net.ssid')" autocomplete="off" :aria-label="t('net.ssidAria')">
      <input ref="passEl" v-model="pass" type="password" :placeholder="t('net.pass')" autocomplete="off" :aria-label="t('net.passAria')">
      <button @click="connectWifi">{{ t('conn.connect') }}</button>
    </div>
    <div class="small">{{ tm(msg) }}</div>
    <details>
      <summary>{{ t('net.setupSummary') }}</summary>
      <pre>[gcode_shell_command wifi_scan]
command: nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list --rescan yes
timeout: 30
verbose: True

[gcode_macro WIFI_SCAN]
gcode:
  RUN_SHELL_COMMAND CMD=wifi_scan

[gcode_shell_command wifi_connect]
command: nmcli
timeout: 40
verbose: False

[gcode_macro WIFI_CONNECT]
gcode:
  RUN_SHELL_COMMAND CMD=wifi_connect PARAMS="dev wifi connect '{params.SSID}' password '{params.PASS}'"</pre>
      <p class="small">{{ t('net.setupNote') }}</p>
    </details>
  </section>
</template>

<style scoped>
.lbl{font-size:12px;color:var(--dim)}
.ifaces{font-size:16px;font-weight:200;line-height:1.8}
.line{display:flex;gap:10px;align-items:center;margin-top:4px}
.line.wrap{gap:8px;flex-wrap:wrap;margin-top:8px}
.small{color:var(--dim);font-size:12px}
.net input,.net button{background:none;border:1px solid var(--line);color:var(--ink);font:inherit;font-size:13px;border-radius:7px;padding:10px 14px}
.net button{cursor:pointer;font-weight:500}
.net button:hover:not(:disabled){border-color:var(--red)}
.net :focus-visible{outline:2px solid var(--red);outline-offset:2px}
.net pre{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:7px;padding:12px;overflow:auto;font:12px/1.5 var(--mono)}
.net summary{cursor:pointer;color:var(--dim);font-size:13px}
.wfl{display:grid;gap:6px;max-width:480px;max-height:240px;overflow:auto}
.wfn{display:flex;justify-content:space-between;gap:12px;text-align:left}
.wfn span:last-child{color:var(--dim);white-space:nowrap}
</style>

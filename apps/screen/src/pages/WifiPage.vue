<script setup>
// Wi‑Fi: інтерфейси хоста, пошук мереж і підключення. Механізм той самий, що у Vyron Web:
// макрос WIFI_SCAN друкує в консоль рядки «SSID:SIGNAL:SECURITY», WIFI_CONNECT підключає (gcode_shell_command + nmcli).
// Під час друку недоступно; якщо макросів немає — показуємо, що потрібне одноразове налаштування.
import { computed, onBeforeUnmount, ref } from 'vue'
import { whenOnline } from '../online'
import { usePrinter } from '../store'
import { t } from '../i18n'
import { interfaces, parseScanLine, BAD_CHARS } from '../net'
import Row from '../components/Row.vue'
import Icon from '../components/Icon.vue'
import Keyboard from '../components/Keyboard.vue'
import ConfirmSheet from '../components/ConfirmSheet.vue'

const SCAN_TIMEOUT = 25000
const SCAN_IDLE = 1500

const p = usePrinter()
const ifaces = ref([])
const nets = ref([])
const scanning = ref(false)
/** null | 'none' | 'setup' | 'busy' | 'sent' | 'badChars' */
const note = ref(null)
const pick = ref(null)
const askOpen = ref(null)

whenOnline(async () => {
  try { ifaces.value = interfaces((await p.call('machine.system_info')).system_info) } catch { ifaces.value = [] }
  scan()
})

let buf = [], timer = 0, off = null
function finish() {
  clearTimeout(timer)
  off && off(); off = null
  if (!scanning.value) return
  scanning.value = false
  const best = {}
  buf.forEach(n => { if (n.ssid && (!best[n.ssid] || best[n.ssid].sig < n.sig)) best[n.ssid] = n })
  nets.value = Object.values(best).sort((a, b) => b.sig - a.sig)
  if (!nets.value.length && !note.value) note.value = 'none'
}
async function scan() {
  if (scanning.value) return
  if (p.active) { note.value = 'busy'; return }
  note.value = null
  buf = []
  scanning.value = true
  off = p.onGcode(line => {
    const n = parseScanLine(line)
    if (!n) return
    buf.push(n)
    clearTimeout(timer)
    timer = setTimeout(finish, SCAN_IDLE)
  })
  timer = setTimeout(finish, SCAN_TIMEOUT)
  try { await p.gcode('WIFI_SCAN') } catch (e) {
    if (/unknown command/i.test(String(e && e.message))) note.value = 'setup'
    finish()
  }
}
onBeforeUnmount(() => { off && off(); clearTimeout(timer) })

const secured = n => n.sec && n.sec !== '--'
function choose(n) {
  if (p.active) { note.value = 'busy'; return }
  if (secured(n)) pick.value = n
  else askOpen.value = n
}
async function connect(ssid, pass) {
  pick.value = null; askOpen.value = null
  if (BAD_CHARS.test(ssid + (pass || ''))) { note.value = 'badChars'; return }
  try {
    await p.gcode('WIFI_CONNECT SSID="' + ssid + '"' + (pass ? ' PASS="' + pass + '"' : ''))
    note.value = 'sent'
  } catch (e) { note.value = /unknown command/i.test(String(e && e.message)) ? 'setup' : 'sent' }
}

const bars = sig => (sig >= 70 ? 3 : sig >= 45 ? 2 : 1)
const NOTE_KEY = { none: 'net.none', setup: 'scr.wifiSetup', busy: 'msg.notWhilePrinting', sent: 'net.sent', badChars: 'net.badChars' }
const wifiIf = computed(() => ifaces.value.filter(i => i.wifi))
const otherIf = computed(() => ifaces.value.filter(i => !i.wifi))
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.wifi') }}</h1>

    <div v-if="ifaces.length" class="grp">
      <Row v-for="i in wifiIf" :key="i.name" icon="wifi" :label="i.name" :value="i.ip || t('scr.wifiOff')" />
      <Row v-for="i in otherIf" :key="i.name" icon="host" :label="i.name" :value="i.ip" />
    </div>

    <div class="grp-h hrow">
      <span>{{ t('scr.networks') }}</span>
      <button type="button" class="scan tap" :disabled="scanning" @click="scan">
        <Icon name="refresh" size="1.5rem" :class="{ spin: scanning }" />{{ scanning ? t('net.scanning') : t('scr.rescan') }}
      </button>
    </div>
    <div v-if="nets.length" class="grp">
      <Row v-for="n in nets" :key="n.ssid" :label="n.ssid" @tap="choose(n)">
        <Icon v-if="secured(n)" name="lock" size="1.5rem" class="lk" />
        <span class="sig" :class="'b' + bars(n.sig)" aria-hidden="true"><i></i><i></i><i></i></span>
      </Row>
    </div>
    <div v-else-if="scanning" class="grp skel"><span v-for="i in 3" :key="i"></span></div>

    <p v-if="note" class="note">{{ t(NOTE_KEY[note]) }}</p>
    <p v-else class="grp-f">{{ t('scr.wifiHint') }}</p>

    <Keyboard v-if="pick" :title="t('scr.passFor', { ssid: pick.ssid })" :ok-label="t('scr.join')" @ok="pass => connect(pick.ssid, pass)" @cancel="pick = null" />
    <ConfirmSheet v-if="askOpen" :text="t('net.confirm', { ssid: askOpen.ssid })" :ok="t('scr.join')" :cancel="t('common.cancel')" @ok="connect(askOpen.ssid)" @cancel="askOpen = null" />
  </div>
</template>

<style scoped>
.hrow{display:flex;align-items:center;justify-content:space-between}
.scan{display:flex;align-items:center;gap:.4rem;height:2.8rem;padding:0 .4rem;border-radius:var(--r-sm);color:var(--coral);font-size:1.15rem;font-weight:600;text-transform:none;letter-spacing:0}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.lk{color:var(--dim)}
/* Рівень сигналу — три стовпчики, як у статус-барі iOS */
.sig{display:flex;align-items:flex-end;gap:.18rem;height:1.5rem}
.sig i{width:.4rem;border-radius:.1rem;background:var(--dim2)}
.sig i:nth-child(1){height:.6rem}
.sig i:nth-child(2){height:1rem}
.sig i:nth-child(3){height:1.5rem}
.b1 i:nth-child(1),.b2 i:nth-child(-n+2),.b3 i{background:var(--ink)}
.skel{display:grid}
.skel span{height:4.6rem;margin-left:1.2rem;box-shadow:inset 0 -1px 0 var(--group-sep)}
.skel span:last-child{box-shadow:none}
</style>

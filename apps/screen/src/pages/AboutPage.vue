<script setup>
// Про систему: версії програм, хост і залізо (лише читання).
import { ref } from 'vue'
import { whenOnline } from '../online'
import { usePrinter, DEMO } from '../store'
import { t } from '../i18n'
import { interfaces } from '../net'
import { VYRON_VERSION, coreInfo } from '@vyron/shared/version'
import Row from '../components/Row.vue'

const p = usePrinter()
const rows = ref([])
const hw = ref([])
const nets = ref([])

const short = v => String(v || '—').replace(/-g[0-9a-f]+$/, '')
whenOnline(async () => {
  const [pi, si, sys, core] = await Promise.all([
    p.call('printer.info').catch(() => ({})),
    p.call('server.info').catch(() => ({})),
    p.call('machine.system_info').then(r => r.system_info || {}).catch(() => ({})),
    coreInfo(p.call)
  ])
  rows.value = [
    { k: 'Vyron Screen', v: 'v' + VYRON_VERSION },
    // У демо ядро не показуємо — для глядача воно нічого не означає
    ...(DEMO ? [] : [{ k: 'Vyron Core', v: core ? 'v' + core.version : t('set.coreNone') }]),
    { k: 'Klipper', v: short(pi.software_version) },
    { k: 'Moonraker', v: short(si.moonraker_version) }
  ]
  const cpu = sys.cpu_info || {}
  const memGb = cpu.total_memory ? (cpu.total_memory / (cpu.memory_units === 'kB' ? 1048576 : 1024)).toFixed(1) + ' ' + t('scr.gb') : '—'
  hw.value = [
    { k: t('set.host'), v: pi.hostname || '—' },
    { k: t('set.os'), v: (sys.distribution || {}).name || '—' },
    { k: t('eng.cpu'), v: [cpu.model, cpu.cpu_count && cpu.cpu_count + ' ' + t('scr.cores')].filter(Boolean).join(' · ') || '—' },
    { k: t('eng.mem'), v: memGb }
  ]
  nets.value = interfaces(sys).map(i => ({ k: i.name, v: i.ip || t('scr.wifiOff') }))
})
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.about') }}</h1>
    <div class="grp"><Row v-for="r in rows" :key="r.k" :label="r.k" :value="r.v" /></div>
    <div class="grp"><Row v-for="r in hw" :key="r.k" :label="r.k" :value="r.v" /></div>
    <div v-if="nets.length" class="grp"><Row v-for="r in nets" :key="r.k" :label="r.k" :value="r.v" /></div>
  </div>
</template>

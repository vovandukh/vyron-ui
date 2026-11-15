<script setup>
// Klipper зупинився / не запустився / не працює: ті самі зрозумілі тексти, що у Vyron Web (kerr.*),
// і велика кнопка перезапуску. Кроки «що зробити» прокручуються, якщо не вміщаються на малому екрані.
import { computed } from 'vue'
import { usePrinter } from '../store'
import { t } from '../i18n'

const p = usePrinter()
const str = k => { const v = t(k); return v === k ? '' : v }

const view = computed(() => {
  const s = p.klippy.state
  if (s === 'startup') return { tone: 'amber', title: t('klippy.startup.t'), desc: str('klippy.startup.d'), hints: [] }
  if (s === 'disconnected') return { tone: 'amber', title: t('klippy.offline.t'), desc: str('klippy.offline.d'), hints: str('klippy.offline.h').split('\n').filter(Boolean) }
  const i = p.klippy.info || { id: 'generic', params: {}, head: '' }
  return {
    tone: 'red',
    eyebrow: t(s === 'error' ? 'klippy.eb.error' : 'klippy.eb.shutdown'),
    title: i.id === 'generic' ? i.head || t('state.klipperError') : t('kerr.' + i.id + '.t', i.params),
    desc: str('kerr.' + i.id + '.d'),
    hints: str('kerr.' + i.id + '.h').split('\n').filter(Boolean),
    // shutdown — скидання MCU (FIRMWARE_RESTART); помилка конфігурації — перечитати конфіг (RESTART)
    action: s === 'error' ? 'restart' : 'fw'
  }
})
</script>

<template>
  <main class="err" :class="'t-' + view.tone">
    <div class="body">
      <small v-if="view.eyebrow" class="eb">{{ view.eyebrow }}</small>
      <h1>{{ view.title }}</h1>
      <p v-if="view.desc" class="desc">{{ view.desc }}</p>
      <ol v-if="view.hints.length" class="hints"><li v-for="(h, i) in view.hints" :key="i">{{ h }}</li></ol>
    </div>
    <footer v-if="view.action" class="acts">
      <button v-if="view.action === 'fw'" type="button" class="btn main tap" :disabled="!!p.busy" @click="p.firmwareRestart()">{{ t('klippy.fw') }}</button>
      <button v-else type="button" class="btn main tap" :disabled="!!p.busy" @click="p.restart()">{{ t('klippy.restart') }}</button>
    </footer>
  </main>
</template>

<style scoped>
.err{--tone:var(--red);height:calc(100% - 4.6rem);display:flex;flex-direction:column;border-top:.3rem solid var(--tone)}
.t-amber{--tone:var(--amber)}
.body{flex:1;min-height:0;overflow-y:auto;padding:1.2rem 1.6rem .8rem;display:grid;align-content:start;gap:.7rem}
.eb{font-size:1.2rem;font-weight:600;color:var(--tone)}
h1{margin:0;font-size:2rem;line-height:1.2;font-weight:700}
.desc{margin:0;font-size:1.35rem;line-height:1.45;color:#c4c7cd}
.hints{margin:.2rem 0 0;padding:0;list-style:none;counter-reset:h;display:grid;gap:.6rem}
.hints li{position:relative;padding-left:2.6rem;font-size:1.3rem;line-height:1.4;color:#d6d9de;counter-increment:h}
.hints li::before{content:counter(h);position:absolute;left:0;top:0;width:1.8rem;height:1.8rem;border-radius:50%;display:grid;place-items:center;font-size:1.05rem;font-weight:700;background:var(--panel-hi)}
.acts{padding:0 1.2rem 1.2rem}
.btn{width:100%;height:5.2rem;border-radius:var(--r);font-size:1.6rem;font-weight:700}
.btn.main{background:#f2f2f4;color:#111113}
</style>

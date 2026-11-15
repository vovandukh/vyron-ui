<script setup>
// Екранна клавіатура в стилі iOS для паролів Wi‑Fi: літери, ⇧, цифри й символи.
// Лапки, \ і фігурні дужки відсутні — їх не можна передати в макрос WIFI_CONNECT.
import { computed, ref } from 'vue'
import { t } from '../i18n'
import Icon from './Icon.vue'

const props = defineProps({ title: { type: String, required: true }, okLabel: { type: String, required: true }, minLength: { type: Number, default: 8 } })
const emit = defineEmits(['ok', 'cancel'])

const value = ref('')
const shown = ref(false)
const shift = ref(false)
const sym = ref(false)

const DIGITS = '1234567890'.split('')
const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map(r => r.split(''))
const SYMBOLS = ['!@#$%^&*()', '-_=+[];:/', '?<>|~`.,'].map(r => r.split(''))
const rows = computed(() => (sym.value ? SYMBOLS : LETTERS.map(r => r.map(c => (shift.value ? c.toUpperCase() : c)))))

function press(c) {
  value.value += c
  if (shift.value && !sym.value) shift.value = false
}
const del = () => { value.value = value.value.slice(0, -1) }
const ready = computed(() => value.value.length >= props.minLength)
</script>

<template>
  <div class="kb-wrap" role="dialog" :aria-label="title">
    <header class="kh">
      <button type="button" class="kl tap" @click="emit('cancel')">{{ t('common.cancel') }}</button>
      <b>{{ title }}</b>
      <button type="button" class="kr tap" :disabled="!ready" @click="emit('ok', value)">{{ okLabel }}</button>
    </header>
    <div class="field">
      <span class="val" :class="{ ph: !value }">{{ value ? (shown ? value : '•'.repeat(value.length)) : t('net.pass') }}<i class="caret"></i></span>
      <button type="button" class="eye tap" :aria-label="t('scr.showPass')" @click="shown = !shown"><Icon name="eye" size="1.9rem" /></button>
    </div>
    <div class="keys">
      <div class="kr-row"><button v-for="c in DIGITS" :key="c" type="button" class="k tap" @click="press(c)">{{ c }}</button></div>
      <div v-for="(r, i) in rows" :key="i" class="kr-row">
        <button v-if="i === 2" type="button" class="k fn tap" :class="{ on: shift && !sym }" :disabled="sym" @click="shift = !shift"><Icon name="shift" size="1.7rem" /></button>
        <button v-for="c in r" :key="c" type="button" class="k tap" @click="press(c)">{{ c }}</button>
        <button v-if="i === 2" type="button" class="k fn tap" @click="del"><Icon name="del" size="1.8rem" /></button>
      </div>
      <div class="kr-row">
        <button type="button" class="k fn wide tap" @click="sym = !sym">{{ sym ? 'abc' : '#+=' }}</button>
        <button type="button" class="k space tap" @click="press(' ')">space</button>
        <button type="button" class="k fn wide tap" @click="press('.')">.</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kb-wrap{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;background:#0d0d0f}
.kh{height:4.2rem;display:flex;align-items:center;gap:1rem;padding:0 1rem}
.kh b{flex:1;min-width:0;text-align:center;font-size:1.35rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kl,.kr{height:3.4rem;padding:0 .8rem;border-radius:var(--r-sm);font-size:1.35rem;color:var(--coral)}
.kr{font-weight:700}
.field{margin:0 1rem .6rem;height:3.8rem;display:flex;align-items:center;gap:.6rem;padding:0 .6rem 0 1.2rem;border-radius:var(--r-sm);background:var(--group)}
.val{flex:1;min-width:0;font-size:1.5rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.06em}
.val.ph{color:var(--dim2);letter-spacing:0}
.caret{display:inline-block;width:.15rem;height:1.8rem;margin-left:.15rem;vertical-align:middle;background:var(--coral)}
.eye{width:3.4rem;height:3.4rem;display:grid;place-items:center;border-radius:var(--r-sm);color:var(--dim)}
.keys{flex:1;display:grid;grid-auto-rows:1fr;gap:.45rem;padding:.2rem .5rem .6rem;background:#1b1b1e}
.kr-row{display:flex;gap:.4rem;justify-content:center}
.k{flex:0 1 4.25rem;min-width:0;border-radius:.6rem;background:#3a3a3e;font-size:1.6rem;font-weight:500;display:grid;place-items:center;box-shadow:0 .1rem 0 rgba(0,0,0,.6)}
.k.fn{flex:1.4 1 0;background:#252528;font-size:1.25rem;font-weight:600}
.k.fn.on{background:#f2f2f4;color:#111}
.k.wide{flex:2 1 0}
.k.space{flex:6 1 0;font-size:1.25rem;color:#d1d1d6}
</style>

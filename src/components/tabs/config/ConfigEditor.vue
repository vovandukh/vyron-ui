<script setup>
// Редактор конфігу: прозорий textarea поверх підсвіченого <pre>, номери рядків, пошук/заміна.
import { computed, ref, watch, nextTick } from 'vue'
import { highlight } from './configHighlight'
import { useI18n } from '../../../composables/useI18n'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'save', 'cursor'])
const { t } = useI18n()

const LINE_H = 20
const ta = ref(null), hl = ref(null), ln = ref(null), findIn = ref(null)
const findOpen = ref(false), q = ref(''), rep = ref('')

const html = computed(() => highlight(props.modelValue))
const lineNums = computed(() => props.modelValue.split('\n').map((_, i) => i + 1).join('\n'))
const matches = computed(() => {
  const a = [], s = q.value, v = props.modelValue
  if (!s) return a
  let i = 0
  while ((i = v.indexOf(s, i)) >= 0) { a.push(i); i += s.length }
  return a
})

function syncScroll() {
  const e = ta.value
  if (!e) return
  hl.value.scrollTop = e.scrollTop; hl.value.scrollLeft = e.scrollLeft; ln.value.scrollTop = e.scrollTop
}
watch(html, () => nextTick(syncScroll))

function emitCursor() {
  const e = ta.value, b = e.value.slice(0, e.selectionStart).split('\n')
  emit('cursor', { line: b.length, col: b[b.length - 1].length + 1 })
}

function onInput(e) { emit('update:modelValue', e.target.value); emitCursor() }

/** Вставка через execCommand зберігає історію Undo; запасний варіант — setRangeText. */
function ins(s) {
  const e = ta.value
  e.focus()
  if (!document.execCommand('insertText', false, s)) {
    e.setRangeText(s, e.selectionStart, e.selectionEnd, 'end')
    emit('update:modelValue', e.value)
  }
}

function onKey(e) {
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey, el = ta.value
  if (e.key === 'Tab') { e.preventDefault(); ins('  ') }
  else if (e.key === 'Enter' && !mod) {
    const v = el.value, s = el.selectionStart, ls = v.lastIndexOf('\n', s - 1) + 1
    e.preventDefault()
    ins('\n' + (v.slice(ls, s).match(/^\s*/) || [''])[0])
  }
  else if (mod && k === 's') { e.preventDefault(); emit('save') }
  else if (mod && k === 'f') { e.preventDefault(); toggleFind(true) }
}

function toggleFind(on) {
  findOpen.value = on === undefined ? !findOpen.value : on
  if (findOpen.value) nextTick(() => { findIn.value.focus(); findIn.value.select() })
}

function go(dir, keep) {
  const a = matches.value, e = ta.value
  if (!a.length) return
  let k = dir > 0 ? a.findIndex(x => x >= e.selectionEnd) : a.slice().reverse().findIndex(x => x < e.selectionStart)
  k = dir > 0 ? (k < 0 ? 0 : k) : (k < 0 ? a.length - 1 : a.length - 1 - k)
  const s = a[k]
  e.focus()
  e.setSelectionRange(s, s + q.value.length)
  e.scrollTop = Math.max(0, e.value.slice(0, s).split('\n').length * LINE_H - e.clientHeight / 2)
  emitCursor()
  if (keep) findIn.value.focus()
}

function replaceOne() {
  const e = ta.value
  if (!q.value) return
  if (e.value.slice(e.selectionStart, e.selectionEnd) === q.value) ins(rep.value)
  go(1)
}

function replaceAll() {
  if (!q.value || !matches.value.length) return
  ta.value.focus()
  ta.value.select()
  ins(ta.value.value.split(q.value).join(rep.value))
}

function onFindKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? -1 : 1, true) }
  else if (e.key === 'Escape') toggleFind(false)
}

function reset() {
  // Після програмної заміни value курсор стоїть у кінці файлу — повертаємо його на початок.
  nextTick(() => { if (ta.value) { ta.value.setSelectionRange(0, 0); ta.value.scrollTop = 0; syncScroll(); emitCursor() } })
}

defineExpose({ toggleFind, focus: () => ta.value?.focus(), reset })
</script>

<template>
  <div v-show="findOpen" class="ceFind">
    <input ref="findIn" v-model="q" :placeholder="t('cfg.find')" :aria-label="t('cfg.find')" @keydown="onFindKey">
    <button :aria-label="t('cfg.prev')" @click="go(-1)">↑</button>
    <button :aria-label="t('cfg.next')" @click="go(1)">↓</button>
    <span>{{ t('cfg.matches', { n: matches.length }) }}</span>
    <input v-model="rep" :placeholder="t('cfg.replaceWith')" :aria-label="t('cfg.replaceWith')">
    <button @click="replaceOne">{{ t('cfg.replace') }}</button>
    <button @click="replaceAll">{{ t('cfg.all') }}</button>
  </div>
  <div class="ceWrap">
    <div ref="ln" class="ceLn">{{ lineNums }}</div>
    <div class="ceCode">
      <pre ref="hl" aria-hidden="true" v-html="html"></pre>
      <textarea ref="ta" :value="modelValue" spellcheck="false" autocapitalize="off" autocomplete="off" :aria-label="t('cfg.editor')"
                @input="onInput" @scroll="syncScroll" @keydown="onKey" @keyup="emitCursor" @click="emitCursor"></textarea>
    </div>
  </div>
</template>

<style scoped>
.ceFind{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ceFind input{width:150px}
.ceFind span{color:var(--dim);font-size:12px}
.ceWrap{flex:1;min-height:200px;display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:rgba(255,255,255,.02)}
.ceLn,.ceCode pre,.view .ceCode textarea{font:13px/20px var(--mono);padding:10px 12px;margin:0;tab-size:2;white-space:pre;letter-spacing:0;box-sizing:border-box}
.ceLn{width:50px;flex:none;overflow:hidden;text-align:right;color:#4a4f58;border-right:1px solid var(--line);user-select:none}
.ceCode{position:relative;flex:1;min-width:0}
.ceCode pre{position:absolute;inset:0;overflow:hidden;pointer-events:none;color:#c9ced6}
.view .ceCode textarea{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:0;background:transparent;color:transparent;caret-color:#fff;resize:none;outline:none;overflow:auto}
.view .ceCode textarea::selection{background:rgba(240,58,46,.4);color:transparent}
/* класи підсвітки генеруються через v-html, тому :deep */
.ceCode :deep(i){font-style:normal}
.ceCode :deep(.c){color:#6b717b}
.ceCode :deep(.s){color:#ff6b60;font-weight:600}
.ceCode :deep(.k){color:#f2f4f5}
.ceCode :deep(.v){color:#ffb4ad}
.ceCode :deep(.j){color:#ff9a90}
.ceCode :deep(.g){color:#fff;font-weight:600}
</style>

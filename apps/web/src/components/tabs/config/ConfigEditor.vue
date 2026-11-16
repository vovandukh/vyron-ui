<script setup>
// Редактор конфігурації Klipper на CodeMirror 6 — «майже IDE»:
//   коментування (Ctrl+/), кілька курсорів (Alt+клік, Ctrl+D), пошук і заміна (Ctrl+F / Ctrl+H, регулярні вирази),
//   перехід до рядка (Ctrl+G), згортання розділів, список розділів, автодоповнення (Ctrl+Пробіл),
//   перевірка помилок, переміщення й дублювання рядків (Alt+↑↓, Shift+Alt+↓), Ctrl+S — зберегти.
// Інтерфейс для ConfigTab той самий, що й раніше: v-model, події save і cursor, toggleFind / focus / reset.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorState, Compartment } from '@codemirror/state'
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from '@codemirror/commands'
import { search, searchKeymap, openSearchPanel, closeSearchPanel, searchPanelOpen, highlightSelectionMatches, gotoLine } from '@codemirror/search'
import { foldGutter, foldKeymap, foldAll, unfoldAll, indentOnInput, bracketMatching } from '@codemirror/language'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { lintGutter, lintKeymap } from '@codemirror/lint'
import { klipperLanguage, klipperHighlight, klipperFold, klipperLinter, klipperCompletion, outline } from './klipperLang'
import { useI18n } from '../../../composables/useI18n'
import { useSettingsStore } from '../../../stores/settingsStore'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'save', 'cursor', 'sections'])
const { t } = useI18n()
const settings = useSettingsStore()
const lang = computed(() => settings.lang)

const host = ref(null)
let view = null
const phrasesC = new Compartment()

// Переклад вбудованих підписів CodeMirror (панель пошуку, згортання тощо)
const UK = {
  'Find': 'Знайти', 'Replace': 'Замінити на', 'next': 'далі', 'previous': 'назад', 'all': 'усі', 'match case': 'регістр',
  'regexp': 'regexp', 'by word': 'ціле слово', 'replace': 'замінити', 'replace all': 'замінити всі', 'close': 'закрити',
  'Go to line': 'Перейти до рядка', 'go': 'перейти', 'Folded lines': 'Згорнуті рядки', 'Unfold line': 'Розгорнути',
  'Fold line': 'Згорнути', 'current match': 'поточний збіг', 'on line': 'у рядку', 'replaced match on line $': 'замінено в рядку $',
  'replaced $ matches': 'замінено: $', 'Selection deleted': 'Виділення видалено', 'Diagnostics': 'Перевірка', 'No diagnostics': 'Без зауважень'
}
const phrases = () => EditorState.phrases.of(lang.value === 'uk' ? UK : {})

// Темна тема у стилі Vyron
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent', color: '#e7e9ec' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '20px' },
  '.cm-content': { caretColor: '#fff', padding: '10px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#fff' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(var(--brand-rgb),.24) !important' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,.035)' },
  '.cm-gutters': { backgroundColor: 'rgba(0,0,0,.18)', color: '#5d636c', border: 'none', borderRight: '1px solid rgba(255,255,255,.05)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,.05)', color: '#c9cdd3' },
  '.cm-foldGutter .cm-gutterElement': { cursor: 'pointer', color: '#7b818a', padding: '0 4px' },
  '.cm-foldPlaceholder': { backgroundColor: 'rgba(var(--accent-rgb),.15)', border: '1px solid rgba(var(--accent-rgb),.4)', color: 'var(--coral)', padding: '0 6px', borderRadius: '4px' },
  '.cm-selectionMatch': { backgroundColor: 'rgba(255,210,138,.14)' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(var(--accent-rgb),.25)', outline: 'none' },
  '.cm-searchMatch': { backgroundColor: 'rgba(255,210,138,.22)', outline: '1px solid rgba(255,210,138,.4)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(var(--accent-rgb),.45)' },
  '.cm-panels': { backgroundColor: 'rgba(14,14,16,.96)', color: 'var(--ink)', borderColor: 'rgba(255,255,255,.08)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid rgba(255,255,255,.08)' },
  '.cm-panel.cm-search': { padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', fontFamily: 'inherit' },
  '.cm-panel input[type=text], .cm-textfield': { background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '6px', color: 'var(--ink)', padding: '5px 8px', font: 'inherit', fontSize: '12.5px' },
  '.cm-panel button, .cm-button': { background: 'rgba(255,255,255,.07)', backgroundImage: 'none', border: '1px solid rgba(255,255,255,.1)', borderRadius: '6px', color: 'var(--ink)', padding: '4px 10px', font: 'inherit', fontSize: '12px', cursor: 'pointer' },
  '.cm-panel label': { fontSize: '12px', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  '.cm-panel button[name=close]': { background: 'none', border: 'none', color: 'var(--dim)', fontSize: '18px' },
  '.cm-tooltip': { backgroundColor: '#1c1c1f', border: '1px solid rgba(255,255,255,.1)', borderRadius: '8px', color: 'var(--ink)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'rgba(var(--accent-rgb),.25)', color: '#fff' },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--mono)', fontSize: '12.5px' },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--red)' },
  '.cm-diagnostic-warning': { borderLeftColor: '#ff9f0a' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--red)', textUnderlineOffset: '3px' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy #ff9f0a', textUnderlineOffset: '3px' },
  '.cm-gutter-lint': { width: '12px' }
}, { dark: true })

function emitCursor(state) {
  const head = state.selection.main.head, line = state.doc.lineAt(head)
  emit('cursor', { line: line.number, col: head - line.from + 1 })
}
const emitSections = state => emit('sections', outline(state.doc))

function extensions() {
  return [
    lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), foldGutter(), drawSelection(), dropCursor(),
    EditorState.allowMultipleSelections.of(true), indentOnInput(), bracketMatching(), closeBrackets(),
    autocompletion({ override: [klipperCompletion], icons: false }), rectangularSelection(), crosshairCursor(),
    highlightActiveLine(), highlightSelectionMatches(), search({ top: true }), lintGutter(),
    klipperLanguage, klipperHighlight, klipperFold, klipperLinter(t), theme, phrasesC.of(phrases()),
    keymap.of([
      { key: 'Mod-s', preventDefault: true, run: () => { emit('save'); return true } },
      ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap,
      ...completionKeymap, ...lintKeymap, indentWithTab
    ]),
    EditorView.updateListener.of(u => {
      if (u.docChanged) {
        emit('update:modelValue', u.state.doc.toString())
        emitSections(u.state)
      }
      if (u.selectionSet || u.docChanged) emitCursor(u.state)
    })
  ]
}

onMounted(() => {
  view = new EditorView({ parent: host.value, state: EditorState.create({ doc: props.modelValue, extensions: extensions() }) })
  emitSections(view.state)
})
onBeforeUnmount(() => { view && view.destroy(); view = null })

// Відкрито інший файл (значення змінилось ззовні) — замінюємо документ без петлі через v-model
watch(() => props.modelValue, v => {
  if (!view || v === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
})
watch(lang, () => view && view.dispatch({ effects: phrasesC.reconfigure(phrases()) }))

// Відкрито інший файл — курсор на початок, м'яка поява, нова історія Undo
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
function reset() {
  if (!view) return
  view.setState(EditorState.create({ doc: props.modelValue, extensions: extensions() }))
  emitCursor(view.state); emitSections(view.state)
  view.scrollDOM.scrollTop = 0
  if (!still && host.value?.animate) host.value.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' })
}

const cmd = fn => () => { if (view) { fn(view); view.focus() } }
function toggleFind(on) {
  if (!view) return
  const open = searchPanelOpen(view.state)
  if (on === false || (on === undefined && open)) closeSearchPanel(view)
  else openSearchPanel(view)
}
/** Перейти до розділу: курсор на заголовок, рядок — посередині екрана */
function goto(from) {
  if (!view) return
  view.dispatch({ selection: { anchor: from }, effects: EditorView.scrollIntoView(from, { y: 'center' }) })
  view.focus()
}

defineExpose({
  toggleFind, reset, goto,
  focus: () => view?.focus(),
  comment: cmd(toggleComment),
  foldAll: cmd(foldAll),
  unfoldAll: cmd(unfoldAll),
  gotoLine: cmd(gotoLine)
})
</script>

<template>
  <div ref="host" class="cm-host" :aria-label="t('cfg.editor')"></div>
</template>

<style scoped>
.cm-host{flex:1;min-height:0;border-radius:var(--r-lg);overflow:hidden;background:rgba(0,0,0,.28);border:1px solid var(--hair)}
.cm-host :deep(.cm-editor){height:100%}
.cm-host :deep(.cm-editor.cm-focused){outline:none}
</style>

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './stores/settingsStore'
import { useDesignStore } from './stores/designStore'
import './assets/main.css'
import { logoDataUri } from '@vyron/shared/logo'
import { watchBuild, saveResume, takeResume, revealReady } from '@vyron/shared/live'
import { usePrinterStore } from './stores/printerStore'
import { useUiStore } from './stores/uiStore'

// Favicon — знак Vyron як SVG data URI: однофайлова збірка (vite-plugin-singlefile) не потребує файлу поруч з HTML.
// Колір — фірмовий колір теми; оновлюється, коли змінюють дизайн.
const icon = document.createElement('link')
icon.rel = 'icon'
icon.type = 'image/svg+xml'
document.head.appendChild(icon)

const app = createApp(App)
app.use(createPinia())

// Налаштування: збереження в localStorage та атрибут lang документа.
const settings = useSettingsStore()
settings.$subscribe(() => settings.persist())
watch(() => settings.lang, l => { document.documentElement.lang = l }, { immediate: true })

// Тема інтерфейсу (сторінка «Дизайн»): застосовується до монтування, щоб перший кадр уже був у потрібних кольорах
const design = useDesignStore()
watch(() => design.d.brand, b => { icon.href = logoDataUri(b) }, { immediate: true })

// Нова версія інтерфейсу на принтері (Update Manager): тихе перезавантаження, коли сторінкою не користуються —
// без відкритих вікон і полів введення; відкрита вкладка повертається.
const ui = useUiStore()
const resume = takeResume()
if (resume && resume.view) { ui.go(resume.view); if (resume.engSection) ui.engSection = resume.engSection }
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')
watchBuild({
  canReload: () => !ui.dialog && !ui.tempModal && !ui.cc && !typing(),
  beforeReload: () => saveResume({ view: ui.view, engSection: ui.engSection })
})

// Безшовне оновлення: знімок старої версії тримається, доки ця не підключиться до принтера й не отримає стан
const printer = usePrinterStore()
let revealed = false
watch(() => printer.link, l => {
  if (!revealed && (l === 'ready' || l === 'shutdown' || l === 'demo')) { revealed = true; setTimeout(revealReady, 300) }
}, { immediate: true })

app.mount('#app')

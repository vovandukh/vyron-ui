import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './stores/settingsStore'
import { useDesignStore } from './stores/designStore'
import './assets/main.css'
import logo from './assets/voron-logo.png'

// Favicon ставиться з JS: імпорт картинки вшивається як data URI, тож однофайлова збірка
// (vite-plugin-singlefile) не потребує окремого файлу поруч з HTML.
const icon = document.createElement('link')
icon.rel = 'icon'
icon.type = 'image/png'
icon.href = logo
document.head.appendChild(icon)

const app = createApp(App)
app.use(createPinia())

// Налаштування: збереження в localStorage та атрибут lang документа.
const settings = useSettingsStore()
settings.$subscribe(() => settings.persist())
watch(() => settings.lang, l => { document.documentElement.lang = l }, { immediate: true })

// Тема інтерфейсу (сторінка «Дизайн»): застосовується до монтування, щоб перший кадр уже був у потрібних кольорах
useDesignStore()

app.mount('#app')

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './stores/settingsStore'
import { useDesignStore } from './stores/designStore'
import './assets/main.css'
import { logoDataUri } from './assets/logo'

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

app.mount('#app')

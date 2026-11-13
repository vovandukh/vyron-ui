import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './stores/settingsStore'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())

// Налаштування: збереження в localStorage та атрибут lang документа.
const settings = useSettingsStore()
settings.$subscribe(() => settings.persist())
watch(() => settings.lang, l => { document.documentElement.lang = l }, { immediate: true })

app.mount('#app')

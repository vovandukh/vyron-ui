import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { logoDataUri } from '@vyron/shared/logo'
import App from './App.vue'
import './styles.css'

const icon = Object.assign(document.createElement('link'), { rel: 'icon', type: 'image/svg+xml', href: logoDataUri() })
document.head.appendChild(icon)

createApp(App).use(createPinia()).mount('#app')

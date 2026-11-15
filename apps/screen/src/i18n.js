// Переклади Screen — ті самі словники, що й у Vyron Web (@vyron/shared/locales).
// Мову обирають на самому екрані (Налаштування → Мова); вона запам'ятовується на цьому пристрої.
import { ref, watch } from 'vue'
import { translate } from '@vyron/shared/i18n'

const KEY = 'vyron.screen.lang'
let saved = 'uk'
try { saved = localStorage.getItem(KEY) || 'uk' } catch { /* без сховища — українська */ }

export const LANGS = [{ id: 'uk', name: 'Українська' }, { id: 'en', name: 'English' }]
export const lang = ref(saved)
watch(lang, l => {
  document.documentElement.lang = l
  try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
}, { immediate: true })

export const t = (key, params) => translate(lang.value, key, params)

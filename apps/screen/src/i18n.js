// Переклади Screen — ті самі словники, що й у Vyron Web (@vyron/shared/locales).
// Мова поки українська; згодом — зі спільних налаштувань у базі Moonraker.
import { ref } from 'vue'
import { translate } from '@vyron/shared/i18n'

export const lang = ref('uk')
export const t = (key, params) => translate(lang.value, key, params)

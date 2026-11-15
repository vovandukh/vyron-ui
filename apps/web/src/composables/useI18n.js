import { useSettingsStore } from '../stores/settingsStore'
import { translate } from '@vyron/shared/i18n'

export { translate }

/**
 * t(key, params) — переклад за ключем; tm(msg) — переклад повідомлення-об'єкта
 * зі стору ({ key, params } або { raw }). Реактивно залежить від settings.lang.
 */
export function useI18n() {
  const settings = useSettingsStore()
  const t = (key, params) => translate(settings.lang, key, params)
  const tm = m => (!m ? '' : typeof m === 'string' ? t(m) : m.raw != null ? m.raw : t(m.key, m.params))
  return { t, tm }
}

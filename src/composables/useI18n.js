import { useSettingsStore } from '../stores/settingsStore'
import uk from '../locales/uk'
import en from '../locales/en'

const dicts = { uk, en }

export function translate(lang, key, params) {
  let v = (dicts[lang] && dicts[lang][key]) ?? uk[key] ?? key
  if (params) v = v.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''))
  return v
}

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

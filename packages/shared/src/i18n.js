// Переклади екосистеми: спільні словники (locales/) і функція підстановки. Мову обирає кожен застосунок сам.
import uk from './locales/uk'
import en from './locales/en'

export const dicts = { uk, en }

/** Текст за ключем: мова → українська як запасна → сам ключ. {name} у тексті замінюється з params. */
export function translate(lang, key, params) {
  let v = (dicts[lang] && dicts[lang][key]) ?? uk[key] ?? key
  if (params) v = v.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''))
  return v
}

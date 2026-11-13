import { defineStore } from 'pinia'

// Той самий ключ, що й в оригінальному HTML — збережені налаштування підхоплюються.
const KEY = 'voronui'
export const DEFAULT_SETTINGS = { lang: 'uk', cEstop: true, cSys: true, invX: false, invY: false, invZ: false, fxy: 3000, fz: 300 }

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    return s && typeof s === 'object' ? s : {}
  } catch { return {} }
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({ ...DEFAULT_SETTINGS, ...load() }),
  actions: {
    /** Числові значення приймаються лише > 0; повертає false, якщо значення відхилено. */
    set(key, value) {
      if (!(key in DEFAULT_SETTINGS)) return false
      if (typeof DEFAULT_SETTINGS[key] === 'number') {
        const n = Number(value)
        if (!(n > 0) || !Number.isFinite(n)) return false
        value = n
      } else if (typeof DEFAULT_SETTINGS[key] === 'boolean') value = !!value
      this[key] = value
      return true
    },
    persist() {
      try { localStorage.setItem(KEY, JSON.stringify(this.$state)) } catch { /* приватний режим */ }
    }
  }
})

import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'
import { DEFAULT_DESIGN, PRESETS, applyDesign, sanitizeDesign, brandFor, hexToRgb } from '@vyron/shared/theme'
import { usePrinterStore } from './printerStore'

const KEY = 'vyron-design'
/** Moonraker database: спільний дизайн для всіх екранів принтера (ПК, планшет, екран принтера) */
const DB = { namespace: 'vyron_ui', key: 'design' }
const SYNC_DELAY = 700

function loadLocal() {
  try { return sanitizeDesign(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return { ...DEFAULT_DESIGN } }
}

/**
 * Дизайн інтерфейсу (сторінка «Дизайн» у налаштуваннях). Зміни застосовуються миттєво (живий перегляд),
 * зберігаються в localStorage (щоб тема була вже на першому кадрі) і, якщо підключено принтер, — у базі Moonraker.
 * При підключенні береться новіша з двох версій (поле updated).
 */
export const useDesignStore = defineStore('design', () => {
  const d = reactive(loadLocal())
  /** Стан синхронізації з принтером: 'local' (лише цей браузер) | 'saving' | 'synced' | 'error' */
  const sync = ref('local')
  const printer = usePrinterStore()
  let timer = 0, applyingRemote = false

  applyDesign(d)

  function touch() {
    d.updated = Date.now()
  }
  function set(key, value) {
    if (!(key in DEFAULT_DESIGN) || key === 'updated') return
    d[key] = sanitizeDesign({ ...d, [key]: value })[key]
    touch()
  }
  function setPreset(id) {
    const p = PRESETS.find(x => x.id === id)
    if (!p) return
    Object.assign(d, { preset: id, accent: p.accent, brand: p.brand })
    touch()
  }
  /** Вільний акцент: глибший фірмовий відтінок підбирається автоматично. */
  function setAccent(hex) {
    if (!hexToRgb(hex)) return
    const accent = String(hex).trim().toLowerCase().replace(/^#?/, '#')
    const p = PRESETS.find(x => x.accent === accent)
    Object.assign(d, p ? { preset: p.id, accent: p.accent, brand: p.brand } : { preset: 'custom', accent, brand: brandFor(accent) })
    touch()
  }
  function reset() {
    Object.assign(d, DEFAULT_DESIGN)
    touch()
  }

  const canSync = () => printer.connected && !printer.demoMode
  async function pushRemote() {
    if (!canSync()) { sync.value = 'local'; return }
    sync.value = 'saving'
    try {
      await printer.call('server.database.post_item', { ...DB, value: { ...d } })
      sync.value = 'synced'
    } catch { sync.value = 'error' }
  }
  async function pullRemote() {
    if (!canSync()) { sync.value = 'local'; return }
    try {
      const r = await printer.call('server.database.get_item', DB)
      const remote = sanitizeDesign(r && r.value)
      if (remote.updated > d.updated) {
        applyingRemote = true
        Object.assign(d, remote)
        sync.value = 'synced'
      } else if (d.updated > remote.updated) pushRemote()
      else sync.value = 'synced'
    } catch {
      // Запису ще немає (перший запуск) — створюємо, якщо користувач уже щось змінював
      if (d.updated) pushRemote()
      else sync.value = 'synced'
    }
  }

  watch(d, () => {
    applyDesign(d)
    try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* приватний режим */ }
    if (applyingRemote) { applyingRemote = false; return }
    clearTimeout(timer)
    if (canSync()) { sync.value = 'saving'; timer = setTimeout(pushRemote, SYNC_DELAY) }
  }, { deep: true })

  // Після кожного (пере)підключення до принтера — звіряємось із базою Moonraker
  watch(() => printer.link, (l, o) => { if (l === 'open' || (l === 'ready' && o !== 'open')) pullRemote(); else if (!printer.connected) sync.value = 'local' }, { immediate: true })

  /** Імпорт із файлу налаштувань: невідомі ключі відкидаються, числа обмежуються */
  function importDesign(raw) {
    Object.assign(d, sanitizeDesign(raw))
    touch()
  }

  return { d, sync, set, setPreset, setAccent, reset, importDesign }
})

// Живе оновлення без перезавантаження сторінки — спільне для Vyron Web і Vyron Screen.
//
// 1. watchDesign: тема, змінена на іншому пристрої, застосовується тут за кілька секунд. Раз на interval
//    читаємо з бази Moonraker лише позначку часу дизайну (одне число); повний дизайн — тільки коли вона змінилась.
//    Якщо працює Vyron Core, сповіщення приходить миттєво, а це опитування лишається запасним шляхом.
// 2. watchBuild: на принтері з'явилась нова збірка інтерфейсу (оновлення через Update Manager) — сторінка
//    непомітно перезавантажується, коли нею ніхто не користується (canReload + кілька секунд без дотиків).
//    Безшовно: View Transition між документами тримає знімок старої сторінки, доки нова не підключиться
//    й не покаже дані (revealReady), тоді знімок плавно розчиняється. Без підтримки — звичайна заміна сторінки.

/**
 * Нова сторінка готова (підключилась і показує дані) — відпустити знімок старої.
 * Сам знімок «тримає» скрипт у <head> index.html (подія pagereveal; ліміт 4 с).
 */
export function revealReady() {
  window.__vyronReady = true
  if (window.__vyronPlay) window.__vyronPlay()
  // Прибрати мітку версії з адреси
  const u = new URL(location.href)
  if (u.searchParams.has('_v')) { u.searchParams.delete('_v'); history.replaceState(history.state, '', u.href) }
}

const DESIGN_UPDATED = { namespace: 'vyron_ui', key: 'design.updated' }

/** @returns функція зупинки */
export function watchDesign({ call, getUpdated, onChange, interval = 3000, visibleOnly = true }) {
  let timer = 0, stopped = false, busy = false
  const shown = () => !visibleOnly || !document.hidden
  async function tick() {
    if (stopped) return
    if (shown() && !busy) {
      busy = true
      try {
        const r = await call('server.database.get_item', DESIGN_UPDATED)
        const u = Number(r && r.value) || 0
        if (u && u !== getUpdated()) await onChange(u)
      } catch { /* дизайн ще ніхто не зберігав */ } finally { busy = false }
    }
    if (!stopped) timer = setTimeout(tick, interval)
  }
  const onVis = () => { if (!document.hidden && !stopped) { clearTimeout(timer); tick() } }
  document.addEventListener('visibilitychange', onVis)
  timer = setTimeout(tick, interval)
  return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis) }
}

const IDLE_MS = 4000
let kick = () => {}

/**
 * Події Vyron Core (notify_agent_event), спільні для Web і Screen.
 * ui_updated — нова збірка: перевірити одразу. design_changed — віддається onDesign(updated).
 * @returns true, якщо подію оброблено
 */
export function handleCoreEvent(e, { onDesign } = {}) {
  if (!e || e.agent !== 'vyron-core') return false
  if (e.event === 'ui_updated') { kick(); return true }
  if (e.event === 'design_changed' && onDesign) { onDesign((e.data || {}).updated); return true }
  return false
}

/**
 * @param {{ canReload?: () => boolean, beforeReload?: () => void, interval?: number,
 *   idle?: number | (() => number), visibleOnly?: boolean }} o
 * idle — скільки мс без дотиків перед перезавантаженням. visibleOnly: false — для екрана принтера (kiosk):
 * браузер без віконного менеджера може вважати сторінку «невидимою», хоча вона завжди на екрані.
 * @returns функція зупинки
 */
export function watchBuild({ canReload = () => true, beforeReload = () => {}, interval = 20000, idle = IDLE_MS, visibleOnly = true } = {}) {
  const shown = () => !visibleOnly || !document.hidden
  const idleMs = () => (typeof idle === 'function' ? idle() : idle)
  // У розробці сторінку оновлює vite (HMR); з диска (file://) перевіряти нічого
  if (import.meta.env.DEV || !location.protocol.startsWith('http')) return () => {}
  const url = location.pathname || '/'
  let tag = null, timer = 0, pending = false, stopped = false
  let lastInput = Date.now()
  const touch = () => { lastInput = Date.now() }
  const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart']
  EVENTS.forEach(e => addEventListener(e, touch, { passive: true, capture: true }))

  async function version() {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (!r.ok) return null
    return r.headers.get('etag') || r.headers.get('last-modified')
  }
  function reload() {
    try { beforeReload() } catch { /* не заважаємо оновленню */ }
    // Не reload, а replace на ту саму адресу з міткою версії: для такої навігації браузер робить
    // View Transition — стара сторінка лишається знімком, доки нова не готова (див. index.html і revealReady).
    const u = new URL(location.href)
    u.searchParams.set('_v', Date.now().toString(36))
    location.replace(u.href)
  }
  async function tick() {
    if (stopped) return
    if (!pending && shown()) {
      try {
        const v = await version()
        if (v && tag && v !== tag) pending = true
        if (v && !tag) tag = v
      } catch { /* принтер тимчасово недоступний */ }
    }
    if (pending && shown() && Date.now() - lastInput > idleMs() && canReload()) { stopped = true; reload(); return }
    timer = setTimeout(tick, pending ? 1000 : interval)
  }
  timer = setTimeout(tick, 1500)
  // Vyron Core повідомив про нову збірку (подія ui_updated) — перевірити зараз, а не через interval
  kick = () => { if (!stopped && !pending) { clearTimeout(timer); tick() } }
  return () => { stopped = true; clearTimeout(timer); EVENTS.forEach(e => removeEventListener(e, touch, { capture: true })) }
}

/** Стан, який треба повернути після такого перезавантаження (вкладка, розділ) — у sessionStorage */
const KEY = 'vyron.resume'
export function saveResume(state) { try { sessionStorage.setItem(KEY, JSON.stringify(state)) } catch { /* приватний режим */ } }
export function takeResume() {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); return v } catch { return null }
}

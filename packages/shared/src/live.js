// Живе оновлення без перезавантаження сторінки — спільне для Vyron Web і Vyron Screen.
//
// 1. watchDesign: тема, змінена на іншому пристрої, застосовується тут за кілька секунд. Раз на interval
//    читаємо з бази Moonraker лише позначку часу дизайну (одне число); повний дизайн — тільки коли вона змінилась.
//    Якщо працює Vyron Core, сповіщення приходить миттєво, а це опитування лишається запасним шляхом.
// 2. watchBuild: на принтері з'явилась нова збірка інтерфейсу (оновлення через Update Manager) — сторінка
//    непомітно перезавантажується, коли нею ніхто не користується (canReload + кілька секунд без дотиків),
//    з коротким згасанням замість різкого мигання.

const DESIGN_UPDATED = { namespace: 'vyron_ui', key: 'design.updated' }

/** @returns функція зупинки */
export function watchDesign({ call, getUpdated, onChange, interval = 3000 }) {
  let timer = 0, stopped = false, busy = false
  async function tick() {
    if (stopped) return
    if (!document.hidden && !busy) {
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

/**
 * @param {{ canReload?: () => boolean, beforeReload?: () => void, interval?: number }} o
 * @returns функція зупинки
 */
export function watchBuild({ canReload = () => true, beforeReload = () => {}, interval = 20000 } = {}) {
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
    const s = document.documentElement.style
    s.transition = 'opacity .3s ease'
    s.opacity = '0'
    setTimeout(() => location.reload(), 320)
  }
  async function tick() {
    if (stopped) return
    if (!pending && !document.hidden) {
      try {
        const v = await version()
        if (v && tag && v !== tag) pending = true
        if (v && !tag) tag = v
      } catch { /* принтер тимчасово недоступний */ }
    }
    if (pending && !document.hidden && Date.now() - lastInput > IDLE_MS && canReload()) { stopped = true; reload(); return }
    timer = setTimeout(tick, pending ? 1000 : interval)
  }
  timer = setTimeout(tick, 1500)
  return () => { stopped = true; clearTimeout(timer); EVENTS.forEach(e => removeEventListener(e, touch, { capture: true })) }
}

/** Стан, який треба повернути після такого перезавантаження (вкладка, розділ) — у sessionStorage */
const KEY = 'vyron.resume'
export function saveResume(state) { try { sessionStorage.setItem(KEY, JSON.stringify(state)) } catch { /* приватний режим */ } }
export function takeResume() {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); return v } catch { return null }
}

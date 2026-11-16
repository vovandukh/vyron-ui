// WebSocket JSON-RPC клієнт Moonraker з автоматичним перепідключенням.

export function normalizeHost(v) {
  return String(v || '').trim().replace(/^https?:\/\//i, '').replace(/^wss?:\/\//i, '').replace(/\/.*$/, '')
}

// Протокол — як у сторінки: https → wss/https, http → ws/http (без змішаного контенту).
// Виняток (лише демо на GitHub Pages, allowLocalInsecure): принтер у локальній мережі не має TLS, тож для
// приватних адрес ідемо через ws/http — браузер пропустить це, якщо користувач дозволив «Небезпечний вміст».
let localInsecure = false
export function allowLocalInsecure() { localInsecure = true }
/** Приватна адреса: 10.*, 172.16–31.*, 192.168.*, 127.*, localhost, *.local, ім'я без крапок */
export function isLocalHost(host) {
  const h = String(host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase()
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === 'localhost' || h.endsWith('.local') || (!!h && !h.includes('.') && !h.includes(':'))
}
const secureFor = host => typeof location !== 'undefined' && location.protocol === 'https:' && !(localInsecure && isLocalHost(host))
export const socketUrl = host => (secureFor(host) ? 'wss://' : 'ws://') + host + '/websocket'
export const httpBase = host => (secureFor(host) ? 'https://' : 'http://') + host
/** Підключення з https-сторінки до принтера без TLS — браузер може заблокувати (змішаний вміст) */
export const mixedContentRisk = host => typeof location !== 'undefined' && location.protocol === 'https:' && localInsecure && isLocalHost(host)

// ---------- вибір хоста принтера (жодних вшитих адрес) ----------
const HOST_KEY = 'vyron.host'
const OLD_HOST_KEY = 'voronui.host'   // до ребрендингу — читаємо, доки не збережено новий

/** Хост, збережений після ручного підключення (порожній — підключатися до хоста сторінки). */
export function savedHost() {
  try { return localStorage.getItem(HOST_KEY) || localStorage.getItem(OLD_HOST_KEY) || '' } catch { return '' }
}

/** Запам'ятати хост ручного підключення; хост самої сторінки не зберігаємо (він і так за замовчуванням). */
export function rememberHost(host) {
  try {
    localStorage.removeItem(OLD_HOST_KEY)
    if (host && host !== location.host) localStorage.setItem(HOST_KEY, host)
    else localStorage.removeItem(HOST_KEY)
  } catch { /* приватний режим */ }
}

/**
 * Хост для автопідключення:
 *   ?host=ip:port → збережений у localStorage → VITE_PRINTER_HOST → хост, з якого відкрито сторінку
 *   (на принтері це сам nginx/Moonraker, у dev — проксі Vite). Сторінку відкрито як файл — порожньо
 *   (адресу вводять вручну; жодних вшитих адрес).
 */
export function resolveHost() {
  const q = new URLSearchParams(location.search).get('host')
  if (q) return normalizeHost(q)
  const s = savedHost()
  if (s) return normalizeHost(s)
  const env = import.meta.env.VITE_PRINTER_HOST
  if (env) return normalizeHost(env)
  return location.protocol.startsWith('http') && location.host ? location.host : ''
}

export class RpcError extends Error {}

/**
 * handlers:
 *  onState(state, info)  — 'connecting' | 'open' | 'error' | 'lost' | 'addrError'
 *  onNotify(method, params)
 *  onRpcError(message)
 *  onInvalid()           — некоректний JSON від сервера
 */
export class MoonrakerClient {
  constructor(handlers) {
    this.h = handlers
    this.ws = null
    this.host = null
    this.rid = 10
    this.pending = new Map()
    this.reconnectTimer = null
    this.reconnectDelay = 1500
    this.intentional = false
  }

  get connected() {
    return !!this.ws && this.ws.readyState === 1
  }

  connect(host) {
    this.close()
    this.intentional = false
    this.host = host
    this.reconnectDelay = 1500
    this._open()
  }

  close() {
    this.intentional = true
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    if (this.ws) {
      this.ws.onclose = null
      try { this.ws.close() } catch { /* ignore */ }
      this.ws = null
    }
    this._rejectAll()
  }

  /** Виклик з очікуванням відповіді. Відхиляється при помилці RPC або відсутності з'єднання. */
  call(method, params = {}) {
    if (!this.connected) return Promise.reject(new Error('WebSocket не підключений'))
    const id = ++this.rid
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }))
    })
  }

  /** Виклик «вистрілив і забув»: відповідь ігнорується (помилки G-code приходять у notify_gcode_response). */
  fire(method, params = {}) {
    if (!this.connected) return false
    this.ws.send(JSON.stringify({ jsonrpc: '2.0', method, params, id: ++this.rid }))
    return true
  }

  _open() {
    const host = this.host
    this.h.onState('connecting', { host })
    let ws
    try { ws = new WebSocket(socketUrl(host)) } catch (e) {
      this.h.onState('addrError', { host, message: e.message })
      return
    }
    this.ws = ws
    ws.onopen = () => { this.reconnectDelay = 1500; this.h.onState('open', { host }) }
    ws.onmessage = ev => this._message(ev)
    ws.onerror = () => this.h.onState('error', { host })
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this._rejectAll()
      if (this.intentional) return
      this.h.onState('lost', { host })
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = setTimeout(() => {
        if (!this.intentional && this.host === host) this._open()
      }, this.reconnectDelay)
      this.reconnectDelay = Math.min(15000, this.reconnectDelay * 1.7)
    }
  }

  _message(ev) {
    let d
    try { d = JSON.parse(ev.data) } catch { this.h.onInvalid?.(); return }
    if (d.id != null && this.pending.has(d.id)) {
      const p = this.pending.get(d.id)
      this.pending.delete(d.id)
      if (d.error) {
        const msg = d.error.message || 'RPC error'
        this.h.onRpcError?.(msg)
        p.reject(new RpcError(msg))
      } else p.resolve(d.result)
      return
    }
    if (d.method) this.h.onNotify(d.method, d.params || [])
  }

  _rejectAll() {
    for (const p of this.pending.values()) p.reject(new Error('closed'))
    this.pending.clear()
  }
}

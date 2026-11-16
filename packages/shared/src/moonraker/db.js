// Читання бази Moonraker без помилок у його журналі.
// На принтері, де Vyron ще нічого не зберігав, простору (namespace) немає, і кожен get_item
// записує в moonraker.log «Key … not found». Для опитування раз на кілька секунд це засмічує журнал,
// тож спершу питаємо список просторів (server.database.list — без помилок) і читаємо ключ лише тоді,
// коли простір уже існує. Підтверджені простори запам'ятовуються, щоб не питати список щоразу.

const known = new Set()

/**
 * @param {(method: string, params?: object) => Promise<any>} call
 * @returns {Promise<any>} значення ключа або undefined, якщо його немає
 */
export async function dbGet(call, namespace, key) {
  if (!known.has(namespace)) {
    const r = await call('server.database.list').catch(() => null)
    const list = (r && r.namespaces) || []
    if (!list.includes(namespace)) return undefined
    known.add(namespace)
  }
  try {
    const r = await call('server.database.get_item', { namespace, key })
    return r ? r.value : undefined
  } catch {
    // Ключа немає (або простір видалили) — наступного разу знову спершу перевіримо список
    known.delete(namespace)
    return undefined
  }
}

/** Після власного запису простір точно існує */
export function dbKnown(namespace) { known.add(namespace) }

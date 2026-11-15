// Єдина версія екосистеми Vyron — з кореневого package.json. Web, Screen і Core (core/vyron_core/__init__.py)
// мають однакову версію; її змінюють разом.
import { version } from '../../../package.json'

export const VYRON_VERSION = version

/**
 * Відомості про Vyron Core: ядро під час старту записує їх у власний простір бази Moonraker (vyron_core/info).
 * @returns {Promise<{version: string, started: number} | null>} null — ядро не встановлене або ще жодного разу не запускалось
 */
export async function coreInfo(call) {
  try {
    const r = await call('server.database.get_item', { namespace: 'vyron_core', key: 'info' })
    return r && r.value && r.value.version ? r.value : null
  } catch { return null }
}

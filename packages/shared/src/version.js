// Єдина версія екосистеми Vyron — з кореневого package.json. Web, Screen і Core (core/vyron_core/__init__.py)
// мають однакову версію; її змінюють разом.
// vyronVersion — те, що бачить користувач, може мати 4 числа для мікрофіксів (0.3.4.1). npm такого не приймає,
// тож поле version пакетів лишається з трьох чисел.
import pkg from '../../../package.json'
import { dbGet } from './moonraker/db.js'

export const VYRON_VERSION = pkg.vyronVersion || pkg.version

/**
 * Відомості про Vyron Core: ядро під час старту записує їх у власний простір бази Moonraker (vyron_core/info).
 * @returns {Promise<{version: string, started: number} | null>} null — ядро не встановлене або ще жодного разу не запускалось
 */
export async function coreInfo(call) {
  const v = await dbGet(call, 'vyron_core', 'info')
  return v && v.version ? v : null
}

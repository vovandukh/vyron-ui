import { useUiStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'

/** Підтвердження через ConfirmModal замість нативних confirm()/prompt(). */
export function useConfirm() {
  const ui = useUiStore()
  const settings = useSettingsStore()

  const toMsg = m => (typeof m === 'string' ? { key: m } : m)

  /** Системна дія: питає лише якщо ввімкнено «підтвердження системних дій» або force. */
  const ask = (message, force = false) =>
    force || settings.cSys ? ui.openDialog({ message: toMsg(message) }) : Promise.resolve(true)

  /** Питає завжди. */
  const confirm = message => ui.openDialog({ message: toMsg(message) })

  /** Поле вводу: рядок або null при скасуванні. */
  const prompt = message => ui.openDialog({ message: toMsg(message), input: true })

  return { ask, confirm, prompt }
}

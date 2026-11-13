import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export const useUiStore = defineStore('ui', () => {
  /** main | tools | console | mesh | hist | eng | cfg | set | upd | net */
  const view = ref('main')
  /** 'nozzle' | 'bed' | null — вікно задання температури */
  const tempModal = ref(null)
  /** Активне вікно підтвердження: { message, input, resolve } */
  const dialog = shallowRef(null)

  function go(v) { view.value = v }

  /** Відкриває ConfirmModal. Promise → true/false, або рядок/null у режимі введення. */
  function openDialog({ message, input = false }) {
    if (dialog.value) dialog.value.resolve(dialog.value.input ? null : false)
    return new Promise(resolve => { dialog.value = { message, input, resolve } })
  }

  function closeDialog(result) {
    const d = dialog.value
    dialog.value = null
    d?.resolve(result)
  }

  return { view, tempModal, dialog, go, openDialog, closeDialog }
})

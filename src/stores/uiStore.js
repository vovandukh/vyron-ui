import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export const useUiStore = defineStore('ui', () => {
  /** main | tools | console | mesh | hist | eng | cfg | set | upd | net */
  const view = ref('main')
  /** 'nozzle' | 'bed' | null — вікно задання температури */
  const tempModal = ref(null)
  /** Активне вікно підтвердження: { message, input, resolve } */
  const dialog = shallowRef(null)

  /** Центр керування (підключення, демо, меню): null або { x } — центр кнопки, з якої відкрито (для transform-origin). */
  const cc = ref(null)
  function toggleCc(el) {
    if (cc.value) { cc.value = null; return }
    const r = el?.getBoundingClientRect?.()
    cc.value = { x: r ? r.left + r.width / 2 : innerWidth - 50, y: r ? r.bottom : 60 }
  }
  const closeCc = () => { cc.value = null }

  /** Підрозділ «Інженерного меню»: 'sys' (діагностика та система) | 'cfg' (конфігурація). Живе всю сесію. */
  const engSection = ref('sys')
  /** Розгорнута картка MCU в «Апаратному забезпеченні» (за замовчуванням — основна плата); null — усі згорнуті */
  const hwOpen = ref('mcu')

  /**
   * «Додому» (клік по логотипу): вкладка «Керування» + закрити все відкрите — центр керування, вікно температури,
   * а поповери самого «Керування» (слайдер телеметрії, меню голови) слухають homeTick.
   */
  const homeTick = ref(0)
  function goHome() {
    go('main')
    tempModal.value = null
    homeTick.value++
  }

  function go(v) {
    // Стара адреса вкладки «Конфіг» тепер — підрозділ «Інженерного меню»
    if (v === 'cfg') { engSection.value = 'cfg'; v = 'eng' }
    view.value = v
    cc.value = null
  }

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

  return { view, tempModal, dialog, cc, toggleCc, closeCc, engSection, hwOpen, homeTick, goHome, go, openDialog, closeDialog }
})

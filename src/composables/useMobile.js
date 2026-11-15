import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * Мобільна розкладка: телефон (≤600 px, напр. зовнішній екран Galaxy Fold) або будь-який портретний екран до 900 px
 * (внутрішній екран Fold, планшет у портреті), а також майже квадратні екрани до 1000 px (розгорнутий Fold у ландшафті).
 * Екрани принтера 1024×600 / 800×480 (16:9…5:3) сюди не потрапляють. Той самий запит — у PrintPreview3D (зсув моделі вгору).
 */
export const MOBILE_QUERY = '(max-width: 600px), (max-width: 900px) and (orientation: portrait), (max-width: 1000px) and (max-aspect-ratio: 5/4)'

export function useMobile() {
  const mq = typeof matchMedia === 'function' ? matchMedia(MOBILE_QUERY) : null
  const mobile = ref(!!(mq && mq.matches))
  const on = e => { mobile.value = e.matches }
  onMounted(() => mq?.addEventListener?.('change', on))
  onBeforeUnmount(() => mq?.removeEventListener?.('change', on))
  return mobile
}

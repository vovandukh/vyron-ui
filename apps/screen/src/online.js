// Сторінка завантажує дані, щойно є зв'язок з Moonraker: одразу при відкритті, якщо він уже є, і ще раз,
// коли з'являється (після тихого оновлення сторінка відкривається раніше за підключення).
import { onMounted, watch } from 'vue'
import { usePrinter } from './store'

export function whenOnline(fn) {
  const p = usePrinter()
  onMounted(() => { if (p.link === 'open') fn() })
  watch(() => p.link, l => { if (l === 'open') fn() })
}

// Прокрутка пальцем на екрані принтера — однаково для тачу й «мишки».
//
// Резистивний тачскрін (TFT35, XPT2046) у Chromium під X11 часто приходить як мишка: перетягування мишкою
// браузер не гортає, а відпускання пальця стає кліком по пункту під ним. Тому вирішуємо самі:
//   * палець зрушив менше SLOP — це натискання, клік проходить як звичайно;
//   * далі — це прокрутка: найближчий прокручуваний контейнер їде за пальцем (з легкою інерцією), а клік,
//     що прийде після відпускання, гаситься — пункт під пальцем не відкривається.
// Нативне панорамування вимкнене (touch-action: none у styles.css), щоб справжній тач не гортав двічі.

const SLOP = 10          // px: дрижання резистивного тачу менше за це — ще натискання
const FRICTION = 0.92    // інерція: частка швидкості, що лишається за кадр (~16 мс)
const MIN_V = 0.05       // px/мс: нижче — зупинка

function scrollable(el) {
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const oy = getComputedStyle(el).overflowY
      if (oy === 'auto' || oy === 'scroll') return el
    }
  }
  return null
}

export function installDragScroll() {
  let box = null, id = null, y0 = 0, top0 = 0, dragging = false
  let lastY = 0, lastT = 0, v = 0, raf = 0

  const stopInertia = () => { cancelAnimationFrame(raf); raf = 0 }

  addEventListener('pointerdown', e => {
    if (e.button > 0) return
    stopInertia()
    box = scrollable(e.target)
    id = e.pointerId; y0 = lastY = e.clientY; lastT = e.timeStamp; v = 0; dragging = false
    top0 = box ? box.scrollTop : 0
  }, { capture: true, passive: true })

  addEventListener('pointermove', e => {
    if (e.pointerId !== id || !box) return
    const dy = e.clientY - y0
    if (!dragging && Math.abs(dy) < SLOP) return
    if (!dragging) {
      dragging = true
      document.documentElement.classList.add('dragging')   // гасить «натиснуту» кнопку під пальцем
      y0 = e.clientY; top0 = box.scrollTop                  // без стрибка на величину SLOP
    }
    box.scrollTop = top0 - (e.clientY - y0)
    const dt = e.timeStamp - lastT
    if (dt > 0) v = 0.8 * ((lastY - e.clientY) / dt) + 0.2 * v
    lastY = e.clientY; lastT = e.timeStamp
  }, { capture: true, passive: true })

  function end(e) {
    if (e.pointerId !== id) return
    id = null
    if (!dragging) { box = null; return }
    document.documentElement.classList.remove('dragging')
    // Клік, що прийде одразу після відпускання, — частина жесту прокрутки, а не натискання
    const kill = ev => { ev.stopPropagation(); ev.preventDefault() }
    addEventListener('click', kill, { capture: true, once: true })
    setTimeout(() => removeEventListener('click', kill, { capture: true }), 80)
    // Інерція
    const el = box
    let t = performance.now()
    if (e.timeStamp - lastT > 80) v = 0   // палець зупинився перед відпусканням
    const step = now => {
      const dt = now - t; t = now
      el.scrollTop += v * dt
      v *= Math.pow(FRICTION, dt / 16)
      raf = Math.abs(v) > MIN_V ? requestAnimationFrame(step) : 0
    }
    if (Math.abs(v) > MIN_V) raf = requestAnimationFrame(step)
    box = null; dragging = false
  }
  addEventListener('pointerup', end, { capture: true, passive: true })
  addEventListener('pointercancel', end, { capture: true, passive: true })
}

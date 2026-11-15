// Демо для розробки (npm run dev:screen, ?demo): імітація друку без принтера.
// ?demo&state=idle|printing|paused|shutdown — потрібний стан одразу. Лише в dev-збірці.

export function startDemo({ merge, setKlippy }) {
  const q = new URLSearchParams(location.search)
  const want = q.get('state') || 'printing'
  if (want === 'shutdown') {
    setKlippy('shutdown', "Heater extruder not heating at expected rate\nSee the 'verify_heater' section in docs/Config_Reference.md\nfor the parameters that control this check.\nPrinter is shutdown")
    return
  }
  setKlippy('ready')
  const idle = want === 'idle'
  let p = idle ? 0 : 0.37, d = 2860
  const tick = () => {
    if (want === 'printing') { p = Math.min(1, p + 0.0004); d += 1 }
    merge({
      print_stats: idle ? { state: 'standby', filename: '' } : {
        state: want === 'paused' ? 'paused' : 'printing',
        filename: 'vyron_vase_0.2mm_PETG_2h40m.gcode',
        print_duration: d,
        info: { current_layer: Math.round(p * 412), total_layer: 412 }
      },
      display_status: { progress: p },
      extruder: { temperature: idle ? 24.6 : 239.8 + Math.random() * 0.4, target: idle ? 0 : 240 },
      heater_bed: { temperature: idle ? 23.9 : 79.9 + Math.random() * 0.2, target: idle ? 0 : 80 }
    })
  }
  tick()
  setInterval(tick, 1000)
}

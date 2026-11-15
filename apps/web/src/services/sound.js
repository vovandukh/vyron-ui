// Короткі звукові сигнали подій друку (WebAudio, без файлів): завершення — два висхідні тони, помилка — два низхідні.
// Браузер дозволяє звук лише після першої взаємодії користувача зі сторінкою — до неї сигнал мовчки пропускається.
let ctx = null

function tone(freq, at, dur, gain = 0.16) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0, ctx.currentTime + at)
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + at + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur)
  o.connect(g).connect(ctx.destination)
  o.start(ctx.currentTime + at)
  o.stop(ctx.currentTime + at + dur + 0.05)
}

/** kind: 'done' | 'error' | 'test' */
export function chime(kind) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    if (kind === 'error') { tone(660, 0, 0.22); tone(440, 0.2, 0.38) }
    else { tone(784, 0, 0.2); tone(1175, 0.16, 0.42) }
  } catch { /* без WebAudio — тиша */ }
}

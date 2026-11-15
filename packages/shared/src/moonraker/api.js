// HTTP API Moonraker: файли конфігурації, G-code, мініатюри.
import { httpBase } from './client'

export const encPath = p => String(p).split('/').map(encodeURIComponent).join('/')
const url = (host, path) => httpBase(host) + path

async function ok(r) {
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r
}

export async function listConfigFiles(host) {
  const r = await (await ok(await fetch(url(host, '/server/files/list?root=config')))).json()
  return (r.result || []).filter(f => /\.(cfg|conf)$/i.test(f.path)).sort((a, b) => a.path.localeCompare(b.path))
}

export async function readConfigFile(host, path) {
  return (await ok(await fetch(url(host, '/server/files/config/' + encPath(path))))).text()
}

export async function uploadConfigFile(host, path, text) {
  const fd = new FormData(), j = path.lastIndexOf('/')
  fd.append('root', 'config')
  if (j > 0) fd.append('path', path.slice(0, j))
  fd.append('file', new Blob([text], { type: 'text/plain' }), path.slice(j + 1))
  await ok(await fetch(url(host, '/server/files/upload'), { method: 'POST', body: fd }))
}

/** Зберігає файл, попередньо поклавши копію старої версії в backups/. */
export async function saveConfigWithBackup(host, path, text, original, isNew) {
  if (!isNew) {
    const d = new Date(), z = n => String(n).padStart(2, '0')
    const ts = '' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds())
    await uploadConfigFile(host, 'backups/' + path.replace(/\//g, '_').replace(/\.(cfg|conf)$/i, '') + '_' + ts + '.cfg', original)
  }
  await uploadConfigFile(host, path, text)
}

export async function fetchGcode(host, filename) {
  return (await ok(await fetch(url(host, '/server/files/gcodes/' + encPath(filename))))).text()
}

/**
 * URL мініатюри G-code файлу (шляхи мініатюр у метаданих — відносно теки файлу).
 * minWidth: найменша мініатюра не вужча за minWidth (для списків), інакше — найбільша.
 */
export function thumbUrl(host, filename, metadata, minWidth = 0) {
  const th = ((metadata && metadata.thumbnails) || []).filter(t => t && t.relative_path)
  if (!th.length || !host) return null
  const sorted = th.slice().sort((a, b) => a.width - b.width)
  const b = minWidth ? sorted.find(t => t.width >= minWidth) || sorted[sorted.length - 1] : sorted[sorted.length - 1]
  const f = String(filename || ''), dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/') + 1) : ''
  return url(host, '/server/files/gcodes/' + encPath(dir + b.relative_path))
}

/** URL найбільшої мініатюри завдання з історії, або null. */
export const jobThumbUrl = (host, job) => thumbUrl(host, job.filename, job.metadata)

const GCODE_EXT = /\.(gcode|g|gco|gc)$/i

/** Список G-code файлів у пам'яті принтера (новіші першими). */
export async function listGcodeFiles(host) {
  const r = await (await ok(await fetch(url(host, '/server/files/list?root=gcodes')))).json()
  return (r.result || []).filter(f => GCODE_EXT.test(f.path)).sort((a, b) => (b.modified || 0) - (a.modified || 0))
}

/** Метадані файлу (слайсер, час, висота шару, мініатюри…). */
export async function fileMetadata(host, filename) {
  const r = await (await ok(await fetch(url(host, '/server/files/metadata?filename=' + encodeURIComponent(filename))))).json()
  return r.result || {}
}

/**
 * Запуск друку файлу з пам'яті принтера. Ім'я передається в query-параметрі,
 * тому кодується цілком (encodeURIComponent), включно з «/» для файлів у підтеках.
 */
export async function startPrintFile(host, filename) {
  await ok(await fetch(url(host, '/printer/print/start?filename=' + encodeURIComponent(filename)), { method: 'POST' }))
}

/**
 * Видалення G-code з пам'яті принтера. Сегменти шляху кодуються окремо, щоб файли
 * в підтеках (calibration/x.gcode) теж видалялись коректно.
 */
export async function deleteGcodeFile(host, filename) {
  await ok(await fetch(url(host, '/server/files/gcodes/' + encPath(filename)), { method: 'DELETE' }))
}

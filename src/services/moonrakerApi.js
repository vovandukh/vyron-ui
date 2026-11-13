// HTTP API Moonraker: файли конфігурації, G-code, мініатюри.
import { httpBase } from './moonrakerClient'

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

/** URL найбільшої мініатюри завдання з історії, або null. */
export function jobThumbUrl(host, job) {
  const th = (job.metadata && job.metadata.thumbnails) || []
  if (!th.length || !host) return null
  const b = th.reduce((a, c) => (c.width > a.width ? c : a))
  const f = String(job.filename || ''), dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/') + 1) : ''
  return url(host, '/server/files/gcodes/' + encPath(dir + b.relative_path))
}

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const r = p => fileURLToPath(new URL(p, import.meta.url))

/**
 * Після збірки кладе копію index.html поруч під іншими іменами (dist/voron.html),
 * щоб застосунок відкривався і за цими адресами. Шляхи до assets відносні (base './'),
 * тому копія працює без змін.
 */
const htmlAliases = names => ({
  name: 'html-aliases',
  apply: 'build',
  async writeBundle(options, bundle) {
    const html = bundle['index.html']
    if (!html) return
    await Promise.all(names.map(n => writeFile(join(options.dir, n), html.source)))
  }
})

// Принтер для dev-проксі: PRINTER_URL=http://<ip-принтера>:7125 npm run dev
// (без змінної — принтер за замовчуванням, див. DEFAULT_PRINTER_HOST у services/moonrakerClient.js).
const PRINTER = process.env.PRINTER_URL || 'http://192.168.0.232:7125'

// Проксі Moonraker: застосунок у dev звертається до власного хоста (localhost:5173),
// а Vite пересилає API і WebSocket на принтер. Origin переписується на адресу принтера,
// щоб Moonraker не відхиляв запити з localhost через cors_domains.
const moonraker = {
  target: PRINTER,
  changeOrigin: true,
  ws: true,
  configure: proxy => {
    proxy.on('proxyReq', req => req.setHeader('origin', PRINTER))
    proxy.on('proxyReqWs', req => req.setHeader('origin', PRINTER))
  }
}

// Вихідний index.html лежить у src/, а не в корені: корінь репозиторію в main
// зайнятий готовою статикою (index.html + assets/), яку CI копіює з dist/.
// mode 'demo' (npm run build:demo): збірка для GitHub Pages у dist-demo/, стартує одразу в демо (.env.demo).
export default defineConfig(({ mode }) => ({
  root: r('./src'),
  envDir: r('.'),          // .env.local і далі читається з кореня проєкту
  cacheDir: r('./node_modules/.vite'),
  base: './',              // відносні шляхи: статику можна віддавати з будь-якої теки nginx
  // viteSingleFile: увесь JS, CSS і картинки вшиваються в один index.html — nginx на принтері
  // може віддавати лише цей файл, без теки assets/. htmlAliases іде після нього й копіює вже готовий файл.
  plugins: [vue(), viteSingleFile(), htmlAliases(['voron.html'])],
  server: {
    proxy: Object.fromEntries(['/websocket', '/printer', '/server', '/machine', '/api'].map(p => [p, moonraker]))
  },
  build: {
    outDir: r(mode === 'demo' ? './dist-demo' : './dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800
  }
}))

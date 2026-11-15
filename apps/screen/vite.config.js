import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const r = p => fileURLToPath(new URL(p, import.meta.url))
const pkg = JSON.parse(readFileSync(r('./package.json'), 'utf8'))

// Проксі Moonraker для розробки — як у Vyron Web. Адреса принтера: PRINTER_URL у apps/screen/.env.local
// (не потрапляє в git) або в змінних середовища; без неї — localhost:7125.
const moonrakerProxy = PRINTER => ({
  target: PRINTER,
  changeOrigin: true,
  ws: true,
  configure: proxy => {
    proxy.on('proxyReq', req => req.setHeader('origin', PRINTER))
    proxy.on('proxyReqWs', req => req.setHeader('origin', PRINTER))
  }
})

// Однофайлова збірка: на принтері nginx віддає один screen.html (CI кладе його в корінь репозиторію).
export default defineConfig(({ mode }) => {
  const PRINTER = process.env.PRINTER_URL || loadEnv(mode, r('.'), '').PRINTER_URL || 'http://localhost:7125'
  const moonraker = moonrakerProxy(PRINTER)
  return {
    root: r('./src'),
    envDir: r('.'),
    cacheDir: r('./node_modules/.vite'),
    base: './',
    plugins: [vue(), viteSingleFile()],
    server: {
      port: 5200,
      proxy: Object.fromEntries(['/websocket', '/printer', '/server', '/machine', '/api'].map(p => [p, moonraker]))
    },
    define: { __VYRON_SCREEN_VERSION__: JSON.stringify(pkg.version) },
    build: { outDir: r('./dist'), emptyOutDir: true }
  }
})

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

const r = p => fileURLToPath(new URL(p, import.meta.url))

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

// Розробка: сторінки-пристрої з demo/ (рамка TFT35 з перемикачем станів і кольорів) — /demo/tft35.html.
// Усередині рамки (../screen.html?state=…) відкривається dev-версія Screen з гарячим оновленням.
const demoPages = () => ({
  name: 'vyron-demo-pages',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const m = /^\/demo\/([\w-]+\.html)/.exec(req.url || '')
      if (!m) return next()
      try { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(await readFile(r('./demo/' + m[1]))) } catch { next() }
    })
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
    plugins: [vue(), viteSingleFile(), demoPages()],
    server: {
      port: 5200,
      proxy: Object.fromEntries(['/websocket', '/printer', '/server', '/machine', '/api'].map(p => [p, moonraker]))
    },
    // mode 'demo' — збірка для GitHub Pages (екран у демо-режимі) у dist-demo/
    build: { outDir: r(mode === 'demo' ? './dist-demo' : './dist'), emptyOutDir: true }
  }
})

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const r = p => fileURLToPath(new URL(p, import.meta.url))

// Принтер для dev-проксі. Інший можна задати змінною середовища: PRINTER_URL=http://host:7125 npm run dev
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
export default defineConfig({
  root: r('./src'),
  envDir: r('.'),          // .env.local і далі читається з кореня проєкту
  cacheDir: r('./node_modules/.vite'),
  base: './',              // відносні шляхи: статику можна віддавати з будь-якої теки nginx
  plugins: [vue()],
  server: {
    proxy: Object.fromEntries(['/websocket', '/printer', '/server', '/machine', '/api'].map(p => [p, moonraker]))
  },
  build: {
    outDir: r('./dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800
  }
})

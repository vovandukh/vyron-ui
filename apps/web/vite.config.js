import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

const r = p => fileURLToPath(new URL(p, import.meta.url))


// Проксі Moonraker: застосунок у dev звертається до власного хоста (localhost:5173),
// а Vite пересилає API і WebSocket на принтер. Origin переписується на адресу принтера,
// щоб Moonraker не відхиляв запити з localhost через cors_domains.
const moonrakerProxy = PRINTER => ({
  target: PRINTER,
  changeOrigin: true,
  ws: true,
  configure: proxy => {
    proxy.on('proxyReq', req => req.setHeader('origin', PRINTER))
    proxy.on('proxyReqWs', req => req.setHeader('origin', PRINTER))
  }
})

// Вихідний index.html лежить у src/, а не в корені: корінь репозиторію в main
// зайнятий готовою статикою (index.html + assets/), яку CI копіює з dist/.
// mode 'demo' (npm run build:demo): збірка для GitHub Pages у dist-demo/, стартує одразу в демо (.env.demo).
// Принтер для dev-проксі: PRINTER_URL у змінних середовища або в .env.local (не потрапляє в git):
//   PRINTER_URL=http://<ip-принтера>:7125
// Без нього — Moonraker на цій самій машині (localhost:7125). Жодних вшитих адрес у репозиторії.
export default defineConfig(({ mode }) => {
  const PRINTER = process.env.PRINTER_URL || loadEnv(mode, r('.'), '').PRINTER_URL || 'http://localhost:7125'
  const moonraker = moonrakerProxy(PRINTER)
  return {
    root: r('./src'),
    envDir: r('.'),          // .env.local і далі читається з кореня проєкту
    cacheDir: r('./node_modules/.vite'),
    base: './',              // відносні шляхи: статику можна віддавати з будь-якої теки nginx
    // viteSingleFile: увесь JS, CSS і картинки вшиваються в один index.html — nginx на принтері
    // може віддавати лише цей файл, без теки assets/.
    plugins: [vue(), viteSingleFile()],
    server: {
      proxy: Object.fromEntries(['/websocket', '/printer', '/server', '/machine', '/api'].map(p => [p, moonraker]))
    },
    build: {
      outDir: r(mode === 'demo' ? './dist-demo' : './dist'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 800
    }
  }
})

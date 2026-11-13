import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const r = p => fileURLToPath(new URL(p, import.meta.url))

// Вихідний index.html лежить у src/, а не в корені: корінь репозиторію в main
// зайнятий готовою статикою (index.html + assets/), яку CI копіює з dist/.
export default defineConfig({
  root: r('./src'),
  envDir: r('.'),          // .env.local і далі читається з кореня проєкту
  base: './',              // відносні шляхи: статику можна віддавати з будь-якої теки nginx
  plugins: [vue()],
  build: {
    outDir: r('./dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800
  }
})

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' — збірку можна покласти в будь-яку підпапку nginx/Moonraker.
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: { chunkSizeWarningLimit: 800 }
})

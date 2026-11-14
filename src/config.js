// Прапорці збірки. Vite підставляє import.meta.env.MODE на етапі збірки, тож у збірці для принтера
// (npm run build) DEMO_BUILD — сталий false: демо-гілки стають мертвим кодом і Rollup викидає їх
// разом із services/demo.js. Демо-режим існує лише в збірці для GitHub Pages (npm run build:demo,
// репозиторій voron_ui_demo) і в npm run dev:demo.
export const DEMO_BUILD = import.meta.env.MODE === 'demo'

// Прапорці збірки. Vite підставляє import.meta.env.MODE / DEV на етапі збірки, тож у збірці для принтера
// (npm run build) DEMO_BUILD — сталий false: демо-гілки стають мертвим кодом і Rollup викидає їх
// разом із services/demo.js.
// Демо-режим (перемикач у центрі керування, ?demo) доступний:
//   • у збірці для GitHub Pages (npm run build:demo, репозиторій voron_ui_demo) — стартує одразу;
//   • у розробці (npm run dev, npm run dev:demo) — для зручності: перемикач і ?demo, без автостарту в dev.
export const DEMO_BUILD = import.meta.env.MODE === 'demo' || import.meta.env.DEV

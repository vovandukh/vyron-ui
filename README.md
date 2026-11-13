# voron_ui

Веб-інтерфейс керування Voron 2.4 з шістьма головками (Klipper / Moonraker) на Vue 3 + Pinia + Vite.

```bash
npm install
npm run dev      # dev-сервер з проксі на принтер
npm run build    # збірка в dist/
```

- У dev-режимі Vite проксіює `/websocket`, `/printer`, `/server`, `/machine`, `/api` на `http://192.168.0.232:7125`, і застосунок підключається до принтера через цей проксі. Інший принтер можна задати так: `PRINTER_URL=http://host:7125 npm run dev`.
- Демо без принтера відкривається за адресою `http://localhost:5173/?demo`.
- Збірку з `dist/` можна віддавати з того самого хоста, що й Moonraker. Тоді інтерфейс сам підключиться до `location.host`.
- Вихідний `index.html` для Vite лежить у `src/`, корінь Vite теж `src/`. Корінь репозиторію в `main` зайнятий готовою статикою: після кожного push у `main` workflow [build-to-main](.github/workflows/build-to-main.yml) збирає проєкт і комітить у корінь `index.html`, `voron.html` та `voron_2_4_six_tool_ui.html`.
- Збірка однофайлова (`vite-plugin-singlefile`): увесь JS, CSS і картинки вшиті в HTML, тож веб-серверу досить віддати один файл без теки `assets/`. Ззовні вантажиться лише шрифт Montserrat (Google Fonts); без інтернету використовується системний шрифт.

## Структура

- `src/stores/`: `printerStore` (з'єднання, статус Klipper, головки, консоль, прогрес), `settingsStore` (localStorage `voronui`), `uiStore` (вкладка, модалки)
- `src/services/`: WebSocket-клієнт Moonraker, HTTP API, Klipper, плати голів (`toolheads.js`: CAN/USB MCU, датчики, вентилятори за пінами екструдера), парсер G-code, модель друку, демо
- `src/components/layout|tabs|modals|viz/`: компоненти інтерфейсу
- `src/locales/`: словники UA / EN

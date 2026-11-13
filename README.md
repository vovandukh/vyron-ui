# voron_ui

Веб-інтерфейс керування Voron 2.4 з шістьма головками (Klipper / Moonraker) на Vue 3 + Pinia + Vite.

```bash
npm install
npm run dev      # dev-сервер; стартує в демо-режимі
npm run build    # збірка в dist/
```

- Щоб у dev-режимі одразу підключатися до принтера, створи `.env.local` з `VITE_PRINTER_HOST=192.168.0.232`.
- Збірку з `dist/` можна віддавати з того самого хоста, що й Moonraker. Тоді інтерфейс сам підключиться до `location.host`.
- Оригінальний однофайловий інтерфейс лежить у `backup/voron_2_4_six_tool_ui.html`.

## Структура

- `src/stores/`: `printerStore` (з'єднання, статус Klipper, головки, консоль, прогрес), `settingsStore` (localStorage `voronui`), `uiStore` (вкладка, модалки)
- `src/services/`: WebSocket-клієнт Moonraker, HTTP API, Klipper, парсер G-code, модель друку, демо
- `src/components/layout|tabs|modals|viz/`: компоненти інтерфейсу
- `src/locales/`: словники UA / EN

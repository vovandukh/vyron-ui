# Vyron Web

Вебінтерфейс Vyron для принтерів на Klipper / Moonraker на Vue 3 + Pinia + Vite. Підтримує будь-яку кількість голів (extruder, extruder1, …) і автоматично знаходить їхні CAN/USB-плати.

```bash
npm install
npm run dev      # dev-сервер з проксі на принтер
npm run build    # збірка в apps/web/dist/
```

- У dev-режимі Vite проксіює `/websocket`, `/printer`, `/server`, `/machine`, `/api` на принтер з `PRINTER_URL` (за замовчуванням `http://localhost:7125`). Адресу свого принтера задайте в `.env.local` (не потрапляє в git): `PRINTER_URL=http://<ip-принтера>:7125` — або через змінну середовища: `PRINTER_URL=http://<ip-принтера>:7125 npm run dev`.
- Хост принтера визначається автоматично, без вшитих адрес: `?host=<ip:порт>` в адресі → хост, збережений після ручного підключення (`localStorage`) → `VITE_PRINTER_HOST` → хост, з якого відкрито сторінку. Протокол береться від сторінки (`https` → `wss`/`https`).
- Збірка для принтера (`npm run build`) **не містить демо-режиму**: немає перемикача, `?demo` ігнорується, демо-дані не потрапляють у файл (прапорець `DEMO_BUILD` у `src/config.js`). У розробці (`npm run dev`) демо доступне — перемикач у центрі керування та `?demo`.
- Демо локально: `npm run dev:demo`, з потрібною кількістю голів: `?demo=1`, `?demo=4` (1–12, за замовчуванням 6).
- Вихідний `index.html` для Vite лежить у `apps/web/src/`, корінь Vite теж там. Корінь репозиторію в `main` зайнятий готовою статикою: після кожного push у `main` workflow [build-to-main](../../.github/workflows/build-to-main.yml) збирає проєкт і комітить у корінь `index.html` і `voron.html` (стара адреса), а також `screen.html`.
- Збірка однофайлова (`vite-plugin-singlefile`): увесь JS, CSS і картинки вшиті в HTML, тож веб-серверу досить віддати один файл без теки `assets/`. Ззовні вантажиться лише шрифт Montserrat (Google Fonts); без інтернету використовується системний шрифт.

## Демо на GitHub Pages

`npm run build:demo` збирає в `apps/web/dist-demo/` версію, що одразу стартує в демо-режимі (`.env.demo`); реальний принтер у ній можна відкрити через `?host=ip:порт`. Workflow [deploy-demo](../../.github/workflows/deploy-demo.yml) після кожного push у `main` публікує її в окремий репозиторій vyron-demo — налаштування описане в самому workflow.

## Структура

- `src/stores/`: `printerStore` (з'єднання, статус Klipper, головки, консоль, прогрес), `settingsStore` (localStorage `voronui`), `uiStore` (вкладка, модалки)
- `src/services/`: WebSocket-клієнт Moonraker, HTTP API, Klipper, плати голів (`toolheads.js`: CAN/USB MCU, датчики, вентилятори за пінами екструдера), парсер G-code, модель друку, демо
- `src/components/layout|tabs|modals|viz/`: компоненти інтерфейсу
- `src/locales/`: словники UA / EN

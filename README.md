# Vyron Ecosystem

Відкрита екосистема для 3D-принтерів на Klipper: вебінтерфейс, застосунок для сенсорного екрана принтера і служба на хості, яка стежить за друком. Без підписок і закритих хмар.

| Частина | Тека | Що це | Стан |
|---|---|---|---|
| **Vyron Web** | [`apps/web`](apps/web) | Вебінтерфейс для ПК, ноутбука, планшета й телефона (Vue 3) | працює |
| **Vyron Screen** | [`apps/screen`](apps/screen) | Застосунок для сенсорного екрана на принтері (TFT35 480×320 і більші) | розробляється |
| **Vyron Core** | [`core`](core) | Служба на хості: миттєва синхронізація теми й оновлень між пристроями; далі Telegram, стеження за аномаліями | працює (ставиться разом з `install.sh`) |
| **@vyron/shared** | [`packages/shared`](packages/shared) | Спільна логіка Web і Screen: розбір помилок Klipper, клієнт Moonraker, теми | наповнюється |
| **Встановлення** | [`install`](install) | `install.sh` / `uninstall.sh` для принтера | працює |

## Встановлення на принтер

**Що потрібно:** принтер із Klipper, Moonraker і Mainsail або Fluidd (звичайна установка через KIAUH).
Усі команди виконуються на принтері — підключись до нього через SSH (наприклад, `ssh biqu@192.168.1.50`;
логін і IP — твої).

**1. Завантаж Vyron**

```bash
cd ~
git clone https://github.com/vovandukh/vyron-ecosystem.git
```

**2. Подивись, що буде зроблено** (нічого не змінює)

```bash
~/vyron-ecosystem/install/install.sh --dry-run
```

**3. Встанови**

```bash
~/vyron-ecosystem/install/install.sh
```

Скрипт може попросити пароль користувача (для `sudo`). Наприкінці він покаже адреси:

| Що | Адреса |
|---|---|
| Vyron Web | `http://IP-принтера/` |
| Vyron Screen | `http://IP-принтера/screen.html` |

Vyron стає основою: у браузері замість Mainsail/Fluidd — Vyron Web, на сенсорному екрані принтера
замість KlipperScreen — Vyron Screen. Mainsail, Fluidd і KlipperScreen не видаляються, а лише ховаються:
видалення Vyron поверне все як було. Якщо Vyron Screen на екрані не запуститься, скрипт сам поверне
KlipperScreen.

- Mainsail потрібен поруч — встанови з `--mainsail-port 66` (буде на `http://IP-принтера:66/`).
- Екран не чіпати — `--no-screen`.
- Перший раз скрипт докачує браузер Chromium для екрана (~100 МБ, кілька хвилин).

**Оновлення** — у Vyron → Налаштування → Оновлення → `vyron`.

**Видалення** — повертає все як було (Mainsail знову на `http://IP-принтера/`):

```bash
~/vyron-ecosystem/install/uninstall.sh
rm -rf ~/vyron-ecosystem
```

Скрипт не чіпає Klipper і `printer.cfg`, не рухає принтер і не гріє. Кожен змінений файл спершу
зберігається в копію (`*.vyron-bak-ДАТА`). Подробиці й параметри — у [install/README.md](install/README.md).

> **Поки репозиторій приватний**, принтеру потрібен ключ лише для читання:
> `ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 && cat ~/.ssh/id_ed25519.pub` — цей рядок додай у
> GitHub → vyron-ecosystem → Settings → Deploy keys (без «Allow write access»), а клонуй так:
> `git clone git@github.com:vovandukh/vyron-ecosystem.git`

## Як частини працюють разом

Усі частини спілкуються з принтером через Moonraker. Спільні налаштування (наприклад, дизайн) зберігаються в базі Moonraker на самому принтері, тому тема, змінена в браузері, діє і на екрані принтера. Vyron Core підключається до Moonraker як агент і повідомляє всім клієнтам про зміни, щоб вони застосовувались одразу.

## Розробка

npm workspaces: одна команда в корені встановлює залежності всіх JS-частин.

```bash
npm install
npm run dev          # Vyron Web з проксі на принтер (PRINTER_URL у apps/web/.env.local)
npm run build        # збірка Web в apps/web/dist/
npm run build:demo   # демо-збірка в apps/web/dist-demo/
```

## Розгортання

Після кожного push у `main` CI збирає Vyron Web і кладе готовий однофайловий `index.html` у корінь репозиторію (а також `voron.html` і `voron_2_4_six_tool_ui.html` — старі адреси). Звідти його віддає nginx на принтері й оновлює Moonraker Update Manager. Демо публікується в окремий публічний репозиторій.
